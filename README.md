# AI News Reader and Predictor

A real-time distributed system that ingests news and social media streams, performs ML-based bias detection (BERT caste-bias), predicts trending topics via Apache Flink burst detection, and delivers real-time alerts to a monitoring dashboard over WebSocket.

## Architecture

The system is a monorepo of five independent microservices:

| Service | Language / Framework | Role |
|---|---|---|
| `ingestion-service` | Node.js / TypeScript | Ingests news APIs and social media streams, publishes to Kafka |
| `analysis-service` | Python / FastAPI | BERT-based caste-bias inference, publishes annotated articles |
| `prediction-service` | Java / Apache Flink | Burst detection and trend forecasting |
| `api-gateway` | NestJS | WebSocket server, REST API, session management |
| `dashboard-ui` | Next.js | Real-time heatmap, controversy alerts, trend visualization |

Kafka topics (3 partitions each): `raw-news` → `analyzed-news` → `predictions`

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24 and Docker Compose ≥ 2.20
- (Optional, for local development) Node.js ≥ 20, Python ≥ 3.11, Java 17, Maven ≥ 3.9

---

## Full-Stack Startup

```bash
# 1. Copy and fill in environment variables
cp .env.example .env

# 2. Build and start all services
docker-compose up --build

# 3. Verify all health endpoints are green
curl http://localhost:3001/health   # ingestion-service
curl http://localhost:8000/health   # analysis-service
curl http://localhost:8080/health   # prediction-service
curl http://localhost:4000/health   # api-gateway
# dashboard-ui: open http://localhost:3000 in a browser
```

To stop and remove containers:

```bash
docker-compose down
```

To also remove volumes (wipes PostgreSQL data):

```bash
docker-compose down -v
```

---

## Per-Service Build Commands

### ingestion-service (Node.js / TypeScript)

```bash
cd ingestion-service
npm install
npm run build          # compiles TypeScript → dist/
npm run start          # runs compiled output
npm run dev            # ts-node watch mode
npm test               # Jest unit + property tests
```

### analysis-service (Python / FastAPI)

```bash
cd analysis-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload   # dev server
pytest                                                        # unit + Hypothesis tests
```

### prediction-service (Java / Maven / Flink)

```bash
cd prediction-service
mvn clean package -DskipTests   # produces fat JAR in target/
mvn test                         # JUnit 5 + jqwik property tests
java -jar target/prediction-service-*.jar   # run locally (requires Kafka + PG)
```

### api-gateway (NestJS)

```bash
cd api-gateway
npm install
npm run build          # compiles TypeScript
npm run start:prod     # production mode
npm run start:dev      # watch mode
npm test               # Jest unit + property tests
```

### dashboard-ui (Next.js)

```bash
cd dashboard-ui
npm install
npm run dev            # development server on :3000
npm run build          # production build
npm run start          # serve production build
npm test               # Jest + React Testing Library + fast-check
```

---

## Environment Variable Reference

Copy `.env.example` to `.env` and fill in values before running `docker-compose up`.

### Kafka

| Variable | Description | Example |
|---|---|---|
| `KAFKA_BROKERS` | Comma-separated list of Kafka broker addresses | `kafka:9092` |
| `KAFKA_LAG_THRESHOLD` | Consumer group lag count that triggers a lag alert | `1000` |

### PostgreSQL

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_HOST` | PostgreSQL hostname | `postgres` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `ainews` |
| `POSTGRES_USER` | Database user | `ainews_user` |
| `POSTGRES_PASSWORD` | Database password | *(set a strong password)* |

### Redis

| Variable | Description | Example |
|---|---|---|
| `REDIS_URL` | Full Redis connection URL | `redis://redis:6379` |
| `SESSION_TTL` | WebSocket session TTL in seconds | `3600` |

### ML / Analysis Service

| Variable | Description | Example |
|---|---|---|
| `BERT_MODEL_PATH` | Path to the HuggingFace BERT model directory | `/models/bert-caste-bias` |

### Burst Detection / Prediction Service

| Variable | Description | Example |
|---|---|---|
| `BURST_THRESHOLD` | Article count per topic that triggers a Burst_Event | `50` |
| `BURST_WINDOW_MS` | Sliding window size in milliseconds | `60000` |

### Ingestion Service

| Variable | Description | Example |
|---|---|---|
| `INGESTION_BUFFER_LIMIT` | Max messages to buffer in memory when Kafka is unavailable | `500` |
| `INGESTION_PORT` | HTTP port for the ingestion-service health endpoint | `3001` |

### API Gateway

| Variable | Description | Example |
|---|---|---|
| `API_GATEWAY_PORT` | HTTP / WebSocket port for the API Gateway | `4000` |

### Dashboard UI

| Variable | Description | Example |
|---|---|---|
| `API_GATEWAY_URL` | WebSocket / REST base URL used by the dashboard | `http://localhost:4000` |
| `DASHBOARD_PORT` | Port the Next.js server listens on | `3000` |

---

## Running the E2E Validation Script

After `docker-compose up` has all services healthy:

```bash
cd e2e
bash validate-pipeline.sh
```

The script waits for all health endpoints, injects a synthetic article, and asserts the full pipeline (ingestion → analysis → prediction → gateway → WebSocket) completes successfully. See `e2e/README.md` for details.

---

## Monorepo Layout

```
.
├── README.md
├── .env.example
├── docker-compose.yml
├── init-db/
│   └── 01_schema.sql          # PostgreSQL DDL — auto-loaded on first PG start
├── kafka-init/
│   └── create-topics.sh       # Creates Kafka topics with 3 partitions each
├── e2e/
│   ├── validate-pipeline.sh
│   └── README.md
├── ingestion-service/
├── analysis-service/
├── prediction-service/
├── api-gateway/
└── dashboard-ui/
```
