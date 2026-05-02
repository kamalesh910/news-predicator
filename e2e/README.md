# E2E Validation — AI News Reader and Predictor

This directory contains the end-to-end validation script for the full AI News Reader and Predictor pipeline. The script validates the complete data flow from ingestion through analysis, prediction, API gateway, and dashboard.

## Prerequisites

Before running the E2E script, ensure the following are in place:

### 1. Full stack running via Docker Compose

```bash
# From the repository root
docker-compose up --build
```

Wait until all services report healthy. You can monitor status with:

```bash
docker-compose ps
```

All five application services must show `healthy` status:
- `ingestion-service` (port 3001)
- `analysis-service` (port 8000)
- `prediction-service` (port 8080)
- `api-gateway` (port 4000)
- `dashboard-ui` (port 3000)

### 2. Docker CLI

The script uses `docker exec` to run `kafka-console-producer` and `kafka-console-consumer` inside the running `kafka` container. Docker must be available on your `PATH`.

```bash
docker --version   # verify Docker is installed
```

### 3. curl

Used for health checks and REST endpoint assertions.

```bash
curl --version   # verify curl is installed
```

### 4. wscat (optional, recommended for WebSocket assertion)

`wscat` is a WebSocket client used to verify that the API Gateway delivers prediction events over WebSocket. Without it, the WebSocket step falls back to a connection-only check via `curl`.

```bash
npm install -g wscat
wscat --version
```

### 5. python3 (optional, for strict biasScore validation)

If `python3` is available, the script uses it to parse JSON and validate that `biasScore` is a number in `[0.0, 1.0]`. Without it, a regex heuristic is used instead.

---

## How to Run

From the repository root:

```bash
bash e2e/validate-pipeline.sh
```

The script prints coloured output for each step and exits with:
- **`0`** — all assertions passed
- **`1`** — one or more assertions failed

### Example output (success)

```
============================================================
  AI News Reader and Predictor — E2E Validation
============================================================

[INFO] Step 1: Checking service health endpoints...
[PASS] ingestion-service is healthy (HTTP 200)
[PASS] analysis-service is healthy (HTTP 200)
[PASS] prediction-service is healthy (HTTP 200)
[PASS] api-gateway is healthy (HTTP 200)
[PASS] dashboard-ui is healthy (HTTP 200)

[INFO] Step 2: Publishing synthetic article to 'raw-news' Kafka topic...
[PASS] Synthetic article published to 'raw-news' via kafka-console-producer (article ID: e2e-test-1714567890-12345)

[INFO] Step 3: Polling 'analyzed-news' topic for analyzed message (timeout: 30s)...
[PASS] Message with valid biasScore found on 'analyzed-news' topic

[INFO] Step 4: Polling 'predictions' topic for BurstEvent or TrendForecast (timeout: 60s)...
[PASS] BurstEvent or TrendForecast found on 'predictions' topic

[INFO] Step 5: Testing WebSocket connection to API Gateway at ws://localhost:4000...
[PASS] WebSocket client received a prediction event from API Gateway

[INFO] Step 6: Querying API Gateway REST endpoint GET /articles...
[PASS] GET /articles returned HTTP 200 with article records

============================================================
  E2E Validation Summary
============================================================
All assertions passed. Pipeline is functioning correctly.
```

---

## What Each Step Validates

### Step 1 — Service Health Checks

Polls each service's health endpoint until it returns HTTP 200 or a 120-second timeout is reached.

| Service | Endpoint | Requirement |
|---|---|---|
| ingestion-service | `http://localhost:3001/health` | 12.1 |
| analysis-service | `http://localhost:8000/health` | 12.2 |
| prediction-service | `http://localhost:8080/health` | 12.3 |
| api-gateway | `http://localhost:4000/health` | 12.4 |
| dashboard-ui | `http://localhost:3000` | 13.5 |

If any service fails to become healthy, the script aborts with exit code 1.

**Validates:** Requirements 12.1, 12.2, 12.3, 12.4

---

### Step 2 — Publish Synthetic Article to Kafka

Publishes a synthetic `RawNewsMessage` JSON payload directly to the `raw-news` Kafka topic using `kafka-console-producer` running inside the `kafka` Docker container.

The synthetic article contains all required fields:
- `articleId` — unique UUID-style identifier with timestamp
- `sourceUrl` — synthetic test URL
- `title` — includes the unique article ID for traceability
- `body` — sufficient text for BERT inference
- `sourceName` — `"E2E Test Suite"`
- `publishedAt` — current UTC timestamp in ISO 8601 format
- `schemaVersion` — `"1.0"`

**Validates:** Requirements 1.1, 2.1, 2.2, 2.3

---

### Step 3 — Assert Analyzed Message on `analyzed-news` Topic

Polls the `analyzed-news` Kafka topic for up to 30 seconds, consuming messages from the beginning. Asserts that at least one message contains a `biasScore` field with a numeric value in `[0.0, 1.0]`.

This confirms that:
- The analysis-service consumed the raw article from `raw-news`
- BERT inference ran successfully
- The analyzed message was published to `analyzed-news`

**Validates:** Requirements 3.1, 3.2, 3.3

---

### Step 4 — Assert Prediction on `predictions` Topic

Polls the `predictions` Kafka topic for up to 60 seconds. Asserts that at least one message contains either:
- A `BurstEvent` (identified by `eventId` + `articleCount` fields), or
- A `TrendForecast` (identified by `forecastId` + `predictedVolume` fields)

This confirms that:
- The prediction-service consumed analyzed articles from `analyzed-news`
- Flink burst detection or trend forecasting produced an output
- The prediction was published to `predictions`

**Validates:** Requirements 5.1, 5.3, 5.4

---

### Step 5 — WebSocket Prediction Event Delivery

Connects a WebSocket client to the API Gateway (`ws://localhost:4000`) and waits up to 10 seconds for a prediction event to be delivered.

- If `wscat` is available: full assertion — verifies a message with prediction fields is received
- If only `curl` is available: connection-only check — verifies the WebSocket upgrade handshake succeeds (HTTP 101)
- If neither is available: step is skipped with a warning

**Validates:** Requirements 7.1, 7.2

---

### Step 6 — REST Endpoint Historical Records

Sends `GET http://localhost:4000/articles` and asserts:
1. The response is HTTP 200
2. The response body is valid JSON
3. The response contains article records (or an empty array if no articles have been persisted yet)

Optionally checks whether the synthetic article from Step 2 appears in the results (may not be present immediately if the pipeline is still processing).

**Validates:** Requirements 7.4, 7.5

---

## Timeouts and Retries

| Step | Timeout | Poll Interval |
|---|---|---|
| Health checks (each service) | 120 seconds | 2 seconds |
| analyzed-news poll | 30 seconds | 2 seconds |
| predictions poll | 60 seconds | 2 seconds |
| WebSocket wait | 10 seconds | — |
| REST endpoint | 10 seconds (curl max-time) | — |

---

## Troubleshooting

### Services not healthy

```bash
docker-compose logs ingestion-service
docker-compose logs analysis-service
docker-compose logs prediction-service
docker-compose logs api-gateway
docker-compose logs dashboard-ui
```

### Kafka topics not created

```bash
docker-compose logs kafka-init
```

If topics are missing, re-run the init container:

```bash
docker-compose run --rm kafka-init
```

### No messages on analyzed-news after 30 seconds

- Check that the analysis-service BERT model loaded successfully: `docker-compose logs analysis-service`
- Verify the `raw-news` topic has messages: `docker exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic raw-news --from-beginning --max-messages 5`

### No predictions after 60 seconds

- The prediction-service uses a sliding window; a single article may not trigger a `BurstEvent`
- Check prediction-service logs: `docker-compose logs prediction-service`
- `TrendForecast` records are generated on a schedule and may take longer to appear

### WebSocket step fails

Install `wscat` for full WebSocket assertion:

```bash
npm install -g wscat
```

Then re-run the E2E script.

---

## Environment Variables

The script uses the default ports defined in `docker-compose.yml`. If you have customised ports via `.env`, update the configuration variables at the top of `validate-pipeline.sh`:

```bash
INGESTION_HEALTH="http://localhost:3001/health"
ANALYSIS_HEALTH="http://localhost:8000/health"
PREDICTION_HEALTH="http://localhost:8080/health"
GATEWAY_HEALTH="http://localhost:4000/health"
DASHBOARD_URL="http://localhost:3000"
GATEWAY_ARTICLES="http://localhost:4000/articles"
GATEWAY_WS="ws://localhost:4000"
```
