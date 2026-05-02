# AI News Reader and Predictor — Project Guide

A real-time distributed system that ingests news and social media streams, runs ML-based caste-bias detection (BERT), predicts trending topics via Apache Flink burst detection, and delivers live alerts to a monitoring dashboard over WebSocket.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Flow](#data-flow)
3. [Prerequisites](#prerequisites)
4. [Quick Start — Full Stack with Docker](#quick-start--full-stack-with-docker)
5. [Service Reference](#service-reference)
   - [ingestion-service](#1-ingestion-service)
   - [analysis-service](#2-analysis-service)
   - [prediction-service](#3-prediction-service)
   - [api-gateway](#4-api-gateway)
   - [dashboard-ui](#5-dashboard-ui)
6. [Dashboard UI — Detailed Guide](#dashboard-ui--detailed-guide)
7. [Infrastructure Services](#infrastructure-services)
8. [Environment Variables](#environment-variables)
9. [REST API Reference](#rest-api-reference)
10. [Running Tests](#running-tests)
11. [E2E Validation](#e2e-validation)
12. [Troubleshooting](#troubleshooting)

---

## System Overview

```
News APIs / Social Streams
         │
         ▼
 ┌─────────────────┐
 │ ingestion-service│  Node.js / TypeScript
 │  (port 3001)    │  Polls HTTP APIs + WebSocket streams
 └────────┬────────┘
          │ raw-news (Kafka)
          ▼
 ┌─────────────────┐
 │ analysis-service │  Python / FastAPI
 │  (port 8000)    │  BERT caste-bias inference
 └────────┬────────┘
          │ analyzed-news (Kafka)
          ▼
 ┌──────────────────┐
 │prediction-service│  Java / Apache Flink
 │  (port 8080)     │  Burst detection + trend forecasting
 └────────┬─────────┘
          │ predictions (Kafka)
          ▼
 ┌─────────────────┐
 │   api-gateway   │  NestJS
 │  (port 4000)    │  WebSocket server + REST API
 └────────┬────────┘
          │ WebSocket
          ▼
 ┌─────────────────┐
 │  dashboard-ui   │  Next.js 14
 │  (port 3000)    │  Real-time monitoring dashboard
 └─────────────────┘
```

---

## Data Flow

1. **Ingestion** — `ingestion-service` polls news APIs (HTTP) and social media streams (WebSocket), validates each article, assigns a UUID, and publishes it as JSON to the `raw-news` Kafka topic.
2. **Analysis** — `analysis-service` consumes `raw-news`, runs BERT inference to produce a `biasScore` (0.0–1.0), and publishes the enriched article to `analyzed-news`. Results are also persisted to PostgreSQL.
3. **Prediction** — `prediction-service` (Flink) consumes `analyzed-news`, applies a sliding-window burst detection operator, and emits `BurstEvent` and `TrendForecast` records to the `predictions` topic. Both are persisted to PostgreSQL.
4. **Gateway** — `api-gateway` consumes `predictions` and broadcasts each message to all connected WebSocket clients. It also exposes REST endpoints for querying historical data from PostgreSQL.
5. **Dashboard** — `dashboard-ui` connects to the API Gateway over WebSocket and renders live heatmaps, controversy alerts, and trend charts as messages arrive.

---

## Prerequisites

### For Docker (recommended)

| Tool | Minimum version |
|---|---|
| Docker | 24+ |
| Docker Compose | 2.20+ |

### For local development (optional)

| Tool | Version |
|---|---|
| Node.js | 20 LTS |
| Python | 3.11+ |
| Java | 17 |
| Maven | 3.9+ |

---

## Quick Start — Single Command

```bash
bash start.sh
```

That's it. The script handles everything: checks Docker is running, creates `.env` from `.env.example` if missing, builds and starts all containers, then waits for every service to pass its health check before printing the URLs.

### All available commands

| Command | What it does |
|---|---|
| `bash start.sh` | Start the full stack (uses cached images) |
| `bash start.sh --build` | Force rebuild all Docker images, then start |
| `bash start.sh --stop` | Stop all containers (data is preserved) |
| `bash start.sh --clean` | Stop containers and delete all data volumes |
| `bash start.sh --status` | Show health status of every service |
| `bash start.sh --logs` | Tail logs from all services |
| `bash start.sh --logs analysis-service` | Tail logs from one service |
| `bash start.sh --help` | Show usage |

### What the start script does step by step

1. Checks Docker and Docker Compose are installed and the daemon is running
2. Creates `.env` from `.env.example` if no `.env` exists
3. Runs `docker-compose up -d` to start all containers in the background
4. Polls each health endpoint until it returns HTTP 200 (or times out after 3 minutes)
5. Prints all service URLs once everything is healthy

### After startup — service URLs

```
Dashboard UI          http://localhost:3000        ← open this in your browser
API Gateway           http://localhost:4000
API Gateway Health    http://localhost:4000/health
Ingestion Health      http://localhost:3001/health
Analysis Health       http://localhost:8000/health
Prediction Health     http://localhost:8080/health

PostgreSQL            localhost:5432
Redis                 localhost:6379
Kafka                 localhost:29092
```

### First run vs subsequent runs

- **First run** — images are built from source. Expect 5–10 minutes depending on your machine and internet speed. The analysis-service takes an extra 60–90 seconds to load the BERT model.
- **Subsequent runs** — cached images are reused. Everything is up in under 60 seconds.
- **After code changes** — use `bash start.sh --build` to rebuild affected images.

---

## Service Reference

### 1. ingestion-service

| Property | Value |
|---|---|
| Language | Node.js 20 / TypeScript |
| Port | `3001` |
| Health endpoint | `GET http://localhost:3001/health` |
| Kafka output | `raw-news` |

**What it does:**
Continuously ingests articles from external sources and publishes them to Kafka. It supports two connector types — HTTP polling (news APIs) and WebSocket streaming (social media). Each article is validated (title, source, timestamp required), assigned a UUID, and serialized as JSON before publishing. If Kafka is temporarily unavailable, articles are buffered in memory (up to `KAFKA_BUFFER_LIMIT`) and flushed when connectivity is restored.

**Local development commands:**

```bash
cd ingestion-service

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Start compiled service
npm start

# Development mode (ts-node, no compile step)
npm run dev

# Run tests
npm test
```

**Key source files:**

```
ingestion-service/src/
├── index.ts                    # Entry point — wires all components
├── kafka/
│   └── producer.ts             # KafkaJS producer with buffer + backoff
├── connectors/
│   ├── newsApiConnector.ts     # HTTP polling connector
│   └── socialStreamConnector.ts# WebSocket stream connector
├── health/
│   └── healthRouter.ts         # GET /health endpoint
└── utils/
    ├── validate.ts             # validateRawArticle() — schema validation
    ├── logger.ts               # Structured JSON logger
    └── lagMonitor.ts           # Kafka consumer lag monitoring
```

---

### 2. analysis-service

| Property | Value |
|---|---|
| Language | Python 3.11 / FastAPI |
| Port | `8000` |
| Health endpoint | `GET http://localhost:8000/health` |
| Kafka input | `analyzed-news` |
| Kafka output | `analyzed-news` |

**What it does:**
Consumes raw articles from `raw-news`, runs BERT-based caste-bias inference on the article body, and publishes the enriched result (with `biasScore`, `biasLabel`, `analysisTimestamp`) to `analyzed-news`. If inference fails, the article is still published with `biasScore: null` and `errorFlag: true` — nothing is dropped. Results are persisted to PostgreSQL with retry logic (3 retries, exponential backoff). The BERT model is loaded into memory before the Kafka consumer starts.

**Local development commands:**

```bash
cd analysis-service

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Run tests (Hypothesis property tests included)
pytest
```

**Key source files:**

```
analysis-service/app/
├── main.py                     # FastAPI app + lifespan startup sequence
├── models/
│   └── schemas.py              # Pydantic models: RawNewsMessage, AnalyzedNewsMessage
├── ml/
│   └── bert_classifier.py      # BertClassifier — load_model() + predict()
├── kafka/
│   └── consumer.py             # AnalysisConsumer — raw-news → analyzed-news
├── db/
│   ├── connection.py           # PostgreSQL connection pool
│   └── repository.py          # save_analyzed_article() with tenacity retry
└── utils/
    ├── validate.py             # validate_raw_message(), validate_bias_score()
    └── logger.py               # Structured JSON logger
```

---

### 3. prediction-service

| Property | Value |
|---|---|
| Language | Java 17 / Apache Flink 1.18 |
| Port | `8080` |
| Health endpoint | `GET http://localhost:8080/health` |
| Kafka input | `analyzed-news` |
| Kafka output | `predictions` |

**What it does:**
A Flink streaming job that consumes analyzed articles, keys them by topic name, and applies a tumbling processing-time window. When article volume for a topic exceeds `BURST_THRESHOLD` within the window, a `BurstEvent` is emitted. A `TrendForecast` is also produced for every window, predicting future volume based on the current window's count. Both event types are published to the `predictions` Kafka topic and persisted to PostgreSQL (with 3-retry exponential backoff). A lightweight HTTP health server runs in a background thread.

**Local development commands:**

```bash
cd prediction-service

# Build fat JAR (skipping tests for speed)
mvn clean package -DskipTests

# Run the Flink job locally (requires Kafka + PostgreSQL running)
java -jar target/prediction-service-*.jar

# Run all tests (JUnit 5 + jqwik property tests)
mvn test

# Build and test together
mvn clean verify
```

**Key source files:**

```
prediction-service/src/main/java/com/ainews/prediction/
├── PredictionJob.java                  # Main Flink job entry point
├── model/
│   ├── BurstEvent.java                 # Burst event POJO
│   ├── TrendForecast.java              # Trend forecast POJO
│   └── AnalyzedNewsMessage.java        # Input message POJO
├── operators/
│   ├── BurstDetectionOperator.java     # ProcessWindowFunction — burst detection
│   └── TrendForecastOperator.java      # ProcessWindowFunction — trend forecasting
├── kafka/
│   ├── KafkaSourceConfig.java          # Flink Kafka source (analyzed-news)
│   └── KafkaSinkConfig.java            # Flink Kafka sink (predictions)
├── db/
│   └── PredictionRepository.java       # JDBC persistence with retry
└── health/
    └── HealthServer.java               # Lightweight HTTP health endpoint
```

---

### 4. api-gateway

| Property | Value |
|---|---|
| Language | Node.js 20 / NestJS |
| Port | `4000` |
| Health endpoint | `GET http://localhost:4000/health` |
| WebSocket | `ws://localhost:4000` |
| Kafka input | `predictions` |

**What it does:**
The central entry point for the dashboard. It consumes prediction messages from Kafka and broadcasts them to all connected WebSocket clients in real time. It also exposes REST endpoints for querying historical data from PostgreSQL. WebSocket sessions are stored in Redis with a configurable TTL; if Redis is unavailable, sessions fall back to in-memory storage with a degraded-mode warning. On startup, it verifies connectivity to Kafka, PostgreSQL, and Redis before accepting connections.

**Local development commands:**

```bash
cd api-gateway

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Start in production mode
npm start

# Start in development/watch mode
npm run start:dev

# Run tests
npm test
```

**REST endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service health + dependency status |
| `GET` | `/articles` | Paginated article list (max 100) |
| `GET` | `/articles/:id` | Single article by UUID |
| `GET` | `/bias-scores` | Paginated bias analysis records |
| `GET` | `/predictions` | Paginated burst events + trend forecasts |

**Key source files:**

```
api-gateway/src/
├── main.ts                         # Bootstrap + startup dependency check
├── app.module.ts                   # Root NestJS module
├── config/
│   └── configuration.ts            # Environment variable loader
├── websocket/
│   ├── websocket.gateway.ts        # @WebSocketGateway — connect/disconnect/broadcast
│   ├── websocket.module.ts
│   └── message-validator.ts        # validateWebSocketMessage()
├── kafka/
│   ├── kafka-consumer.service.ts   # Consumes predictions → broadcasts to WS clients
│   └── kafka-consumer.module.ts
├── articles/
│   ├── articles.controller.ts      # REST endpoints
│   ├── articles.service.ts         # DB queries
│   └── articles.module.ts
├── db/
│   ├── db.service.ts               # PostgreSQL connection pool (pg)
│   └── db.module.ts
├── health/
│   ├── health.controller.ts        # GET /health — pings Kafka, PG, Redis
│   └── health.module.ts
└── utils/
    └── logger.ts                   # Structured JSON logger
```

---

### 5. dashboard-ui

| Property | Value |
|---|---|
| Language | TypeScript / Next.js 14 |
| Port | `3000` |
| URL | `http://localhost:3000` |
| WebSocket | Connects to `api-gateway` at port 4000 |

**What it does:**
A real-time monitoring dashboard that connects to the API Gateway over WebSocket and renders live data as it arrives. See the [Dashboard UI — Detailed Guide](#dashboard-ui--detailed-guide) section below for a full breakdown of every component.

**Local development commands:**

```bash
cd dashboard-ui

# Install dependencies
npm install

# Start development server (hot reload)
npm run dev
# → Open http://localhost:3000

# Production build
npm run build

# Serve production build
npm start

# Run tests
npm test
```

---

## Dashboard UI — Detailed Guide

Open **http://localhost:3000** in your browser after starting the stack.

### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  AI News Dashboard                    ● Connected        │  ← Header (sticky)
├─────────────────────────────────────────────────────────┤
│  ⚠ Controversy Detected: politics — 87 articles         │  ← Controversy Alerts
│  ⚠ Controversy Detected: economy — 52 articles          │    (appear when burst events arrive)
├─────────────────────────────────────────────────────────┤
│  Real-Time Bias Heatmap                                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ BBC News (12)                                    │   │  ← Clickable region header
│  │ [Article] [Article] [Article] [Article]          │   │  ← Color-coded article cards
│  │ Reuters (8)                                      │   │
│  │ [Article] [Article] [Article]                    │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Articles  (BBC News — 12 articles)                      │  ← Article Filter Panel
│  ┌──────────────────────────────────────────────────┐   │    (filtered by clicked region)
│  │ Article title...          BBC News · 2h ago · 0.72│  │
│  │ Article title...          BBC News · 3h ago · 0.15│  │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Trend Forecasts                                         │  ← Trend Panel (area chart)
│  [Area chart: Predicted Volume + Confidence %]           │
│  [Data table below chart]                                │
└─────────────────────────────────────────────────────────┘
```

---

### Component Details

#### Connection Status (header, top-right)

Shows the live WebSocket connection state between the browser and the API Gateway.

| Indicator | Color | Meaning |
|---|---|---|
| ● Connected | Green | WebSocket is open and receiving data |
| ● Reconnecting… | Yellow | Connection lost, auto-reconnect in progress |
| ● Disconnected | Red | Connection is down, retrying |

The socket automatically reconnects with a 1-second delay and unlimited retry attempts. No manual action is needed.

---

#### Controversy Alerts

Appears at the top of the page whenever a **BurstEvent** is received over WebSocket. A burst event means article volume for a specific topic exceeded the configured threshold (`BURST_THRESHOLD`, default 50) within the detection window.

Each alert banner shows:
- **Topic name** — the subject that triggered the burst
- **Article count** — how many articles were in the burst window
- **Detection timestamp** — when the burst was detected

Alerts render within 1 second of receipt and stack vertically if multiple bursts occur simultaneously.

---

#### Real-Time Bias Heatmap

Displays all articles received over WebSocket, grouped by **source name** (treated as a "region"). Each article is rendered as a color-coded card:

| Card color | Bias score range | Meaning |
|---|---|---|
| 🟢 Green | 0.00 – 0.32 | Low bias detected |
| 🟡 Yellow | 0.33 – 0.66 | Moderate bias detected |
| 🔴 Red | 0.67 – 1.00 | High bias detected |
| ⬜ Gray | N/A | Inference failed or score unavailable |

Each card displays:
- Article **title** (truncated to 2 lines)
- **Source name**
- **Publication timestamp**
- **Bias score** (e.g. `0.74`)

**Clicking a region header** (e.g. "BBC News (12)") filters the Article Filter Panel below to show only articles from that source.

---

#### Article Filter Panel

Shows a detailed list of articles from the **selected heatmap region**. Before any region is clicked, it displays a "Select a region to view its articles" prompt.

Each article entry shows:
- Full **title**
- **Source name**
- **Publication timestamp**
- **Bias score** with color coding (green / yellow / red)

---

#### Trend Forecasts Panel

Renders an **area chart** of `TrendForecast` messages received over WebSocket. The chart updates live as new forecasts arrive.

The chart has two overlaid areas:
- **Blue area** — Predicted Volume (left Y-axis)
- **Green area** — Confidence % (right Y-axis, 0–100%)

The X-axis shows topic names. Hovering over a data point shows a tooltip with the topic name, predicted volume, confidence percentage, and forecast horizon timestamp.

Below the chart, a **data table** lists the same information in accessible tabular form with columns: Topic, Predicted Volume, Confidence, Forecast Horizon.

---

#### System Health Indicator

*(Available as a component — `SystemHealthIndicator.tsx` — that can be added to the layout)*

Polls `GET /health` on the API Gateway every 30 seconds and displays:

| Indicator | Color | Meaning |
|---|---|---|
| ● Healthy | Green | All dependencies (Kafka, PostgreSQL, Redis) are reachable |
| ● Degraded | Yellow | One or more dependencies are unreachable |
| ● Unknown | Gray | Initial check not yet complete |

---

### WebSocket Message Types

The dashboard handles three message types from the API Gateway:

| `type` field | Routed to | Description |
|---|---|---|
| `burst_event` | Controversy Alerts | A topic exceeded the burst threshold |
| `trend_forecast` | Trend Panel | A new volume forecast for a topic |
| *(anything else)* | Heatmap | Treated as an article record |

---

## Infrastructure Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| Zookeeper | `confluentinc/cp-zookeeper:7.6.1` | — | Kafka cluster coordination |
| Kafka | `confluentinc/cp-kafka:7.6.1` | `29092` (host) | Message bus |
| kafka-init | `confluentinc/cp-kafka:7.6.1` | — | One-shot topic creation |
| PostgreSQL | `postgres:16-alpine` | `5432` | Persistent storage |
| Redis | `redis:7.2-alpine` | `6379` | Session storage + caching |

**Kafka topics** (3 partitions each, replication factor 1):

| Topic | Producer | Consumer |
|---|---|---|
| `raw-news` | ingestion-service | analysis-service |
| `analyzed-news` | analysis-service | prediction-service |
| `predictions` | prediction-service | api-gateway |

**PostgreSQL tables** (auto-created from `init-db/01_schema.sql`):

| Table | Contents |
|---|---|
| `articles` | Raw article records |
| `bias_records` | BERT analysis results per article |
| `burst_events` | Detected burst events |
| `trend_forecasts` | Trend forecast records |
| `ws_event_log` | WebSocket event delivery audit log |

---

## Environment Variables

Copy `.env.example` to `.env` before running `docker-compose up`.

### Kafka

| Variable | Default | Description |
|---|---|---|
| `KAFKA_BROKERS` | `kafka:9092` | Comma-separated broker addresses |
| `KAFKA_LAG_THRESHOLD` | `1000` | Message lag count that triggers a warning log |
| `KAFKA_BUFFER_LIMIT` | `500` | Max messages buffered when Kafka is unavailable |

### PostgreSQL

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_HOST` | `postgres` | Database hostname |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_DB` | `ainews` | Database name |
| `POSTGRES_USER` | `ainews_user` | Database user |
| `POSTGRES_PASSWORD` | `changeme` | **Change this before deploying** |

### Redis

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379` | Full Redis connection URL |
| `SESSION_TTL` | `3600` | WebSocket session TTL in seconds |

### Analysis Service

| Variable | Default | Description |
|---|---|---|
| `BERT_MODEL_PATH` | `/models/bert-caste-bias` | Path to HuggingFace BERT model directory |

### Prediction Service

| Variable | Default | Description |
|---|---|---|
| `BURST_THRESHOLD` | `50` | Article count per topic to trigger a BurstEvent |
| `BURST_WINDOW_MS` | `60000` | Sliding window size in milliseconds |

### Ingestion Service

| Variable | Default | Description |
|---|---|---|
| `NEWS_API_URL` | — | HTTP endpoint to poll for articles |
| `NEWS_API_KEY` | — | API key sent as `X-Api-Key` header |
| `NEWS_API_POLL_INTERVAL_MS` | `60000` | How often to poll the news API |
| `SOCIAL_STREAM_URL` | — | WebSocket URL for social media stream |
| `SOCIAL_STREAM_AUTH_TOKEN` | — | Bearer token for the social stream |
| `HEALTH_PORT` | `3001` | Port for the health endpoint |

### API Gateway

| Variable | Default | Description |
|---|---|---|
| `API_GATEWAY_PORT` | `4000` | HTTP + WebSocket port |
| `SESSION_TTL` | `3600` | Redis session TTL in seconds |

### Dashboard UI

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_GATEWAY_URL` | `http://localhost:4000` | API Gateway base URL (exposed to browser) |
| `DASHBOARD_PORT` | `3000` | Next.js server port |

---

## REST API Reference

Base URL: `http://localhost:4000`

### Health

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "api-gateway",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "dependencies": {
    "kafka": "ok",
    "postgres": "ok",
    "redis": "ok"
  }
}
```

### Articles

```
GET /articles?page=1&pageSize=20
```

Query params: `page` (default 1), `pageSize` (default 20, max 100)

```
GET /articles/:id
```

Returns 404 if not found.

### Bias Scores

```
GET /bias-scores?page=1&pageSize=20
```

### Predictions

```
GET /predictions?page=1&pageSize=20
```

Returns a merged list of burst events and trend forecasts, ordered by creation time descending.

---

## Running Tests

### ingestion-service

```bash
cd ingestion-service
npm test
# Runs Jest + fast-check property tests
# Includes: errorLog.property.test.ts (Property 22 — structured log schema)
```

### analysis-service

```bash
cd analysis-service
source .venv/bin/activate
pytest
# Runs Hypothesis property tests
```

### prediction-service

```bash
cd prediction-service
mvn test
# Runs JUnit 5 + jqwik property tests
```

### api-gateway

```bash
cd api-gateway
npm test
```

### dashboard-ui

```bash
cd dashboard-ui
npm test
```

---

## E2E Validation

After `docker-compose up` has all services healthy, run the end-to-end validation script:

```bash
bash e2e/validate-pipeline.sh
```

The script:
1. Waits for all five health endpoints to return HTTP 200
2. Publishes a synthetic article to the `raw-news` Kafka topic
3. Polls `analyzed-news` and asserts a message with a valid `biasScore` appears within 30 seconds
4. Polls `predictions` and asserts a `BurstEvent` or `TrendForecast` appears within 60 seconds
5. Tests WebSocket connectivity to the API Gateway
6. Queries `GET /articles` and asserts the endpoint returns HTTP 200

Exits `0` on full success, `1` on any failure with a descriptive error message.

See `e2e/README.md` for detailed documentation.

---

## Troubleshooting

### Services not starting

```bash
# Check logs for a specific service
docker-compose logs ingestion-service
docker-compose logs analysis-service
docker-compose logs prediction-service
docker-compose logs api-gateway
docker-compose logs dashboard-ui

# Check infrastructure
docker-compose logs kafka
docker-compose logs postgres
docker-compose logs redis
```

### Kafka topics not created

```bash
docker-compose logs kafka-init

# Manually re-run topic creation
docker-compose run --rm kafka-init
```

### Dashboard shows "Disconnected"

- Verify the API Gateway is running: `curl http://localhost:4000/health`
- Check `NEXT_PUBLIC_API_GATEWAY_URL` in your `.env` — it must be reachable from the browser (use `localhost`, not the Docker service name)

### analysis-service slow to start

The BERT model load takes 30–90 seconds depending on hardware. The health endpoint returns `"status": "degraded"` with `"model_loaded": false` until loading completes. The Kafka consumer does not start until the model is fully loaded.

### PostgreSQL connection refused

Ensure the `postgres` container is healthy before starting application services:

```bash
docker-compose up postgres
# Wait for "database system is ready to accept connections"
docker-compose up --build
```

### Port conflicts

If any default port is already in use, override it in `.env`:

```bash
HEALTH_PORT=3011          # ingestion-service health
API_GATEWAY_PORT=4001     # api-gateway
DASHBOARD_PORT=3001       # dashboard-ui
```

---

## Monorepo Layout

```
.
├── README.md                   # Quick-start reference
├── PROJECT_GUIDE.md            # This document
├── .env.example                # Environment variable template
├── docker-compose.yml          # Full-stack orchestration
├── init-db/
│   └── 01_schema.sql           # PostgreSQL DDL (auto-loaded on first start)
├── kafka-init/
│   └── create-topics.sh        # Creates Kafka topics (3 partitions each)
├── e2e/
│   ├── validate-pipeline.sh    # End-to-end validation script
│   └── README.md               # E2E documentation
├── ingestion-service/          # Node.js / TypeScript
├── analysis-service/           # Python / FastAPI
├── prediction-service/         # Java / Apache Flink
├── api-gateway/                # NestJS
└── dashboard-ui/               # Next.js 14
```
