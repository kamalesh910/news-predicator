# Requirements Document

## Introduction

The AI News Reader and Predictor is a real-time distributed system that ingests news and social media streams, performs ML-based bias detection (caste-bias via BERT), predicts trending topics through burst detection (Apache Flink), and delivers real-time alerts via WebSocket to a monitoring dashboard. The system is structured as a monorepo of five independent microservices — ingestion-service, analysis-service, prediction-service, api-gateway, and dashboard-ui — orchestrated via Docker Compose, with Apache Kafka as the central message bus.

## Glossary

- **Ingestion_Service**: The Node.js/TypeScript microservice responsible for consuming news and social media streams and publishing raw articles to Kafka.
- **Analysis_Service**: The Python/FastAPI microservice responsible for BERT-based caste-bias detection on raw news articles.
- **Prediction_Service**: The Java/Apache Flink microservice responsible for burst detection and trend forecasting on analyzed articles.
- **API_Gateway**: The NestJS microservice that acts as the central entry point, managing WebSocket connections, user sessions, and persistence.
- **Dashboard_UI**: The Next.js frontend application that displays real-time heatmaps, controversy alerts, and trend visualizations.
- **Kafka**: The Apache Kafka message broker serving as the central message bus between microservices.
- **raw-news**: The Kafka topic to which the Ingestion_Service publishes raw news articles.
- **analyzed-news**: The Kafka topic to which the Analysis_Service publishes bias-annotated articles.
- **predictions**: The Kafka topic to which the Prediction_Service publishes burst detection and trend forecast results.
- **Bias_Score**: A numeric value in the range [0.0, 1.0] representing the probability of caste-bias detected by the BERT model.
- **Burst_Event**: A data structure representing a detected surge in article volume for a given topic within a time window.
- **Trend_Forecast**: A data structure representing a predicted future trend derived from historical article patterns.
- **PostgreSQL**: The relational database used for persistent storage of news archives, analysis results, and prediction records.
- **Redis**: The in-memory data store used for session management and caching.
- **WebSocket**: The persistent bidirectional connection protocol used between the API_Gateway and Dashboard_UI.
- **Heatmap**: A visual representation on the Dashboard_UI showing geographic or topical concentration of bias-flagged articles.
- **Controversy_Alert**: A real-time notification pushed to the Dashboard_UI when a Burst_Event or high-bias article cluster is detected.

## Requirements

### Requirement 1: News and Social Media Ingestion

**User Story:** As a system operator, I want the system to continuously ingest news articles and social media posts from external sources, so that the analysis pipeline always has fresh data to process.

#### Acceptance Criteria

1. WHEN a news article or social media post is received from an external source, THE Ingestion_Service SHALL publish it as a structured message to the `raw-news` Kafka topic within 2 seconds of receipt.
2. THE Ingestion_Service SHALL support simultaneous connections to multiple news API sources and social media stream endpoints.
3. WHEN an external source connection is lost, THE Ingestion_Service SHALL attempt reconnection with exponential backoff and log the disconnection event.
4. IF a received article is malformed or missing required fields (title, source, timestamp), THEN THE Ingestion_Service SHALL discard the message and emit a structured error log entry.
5. THE Ingestion_Service SHALL assign a unique identifier to each ingested article before publishing to Kafka.
6. WHEN the `raw-news` Kafka topic is unavailable, THE Ingestion_Service SHALL buffer incoming messages in memory up to a configurable limit and resume publishing when connectivity is restored.

---

### Requirement 2: Raw News Kafka Message Schema

**User Story:** As a developer integrating downstream services, I want raw news messages on Kafka to follow a consistent schema, so that consumers can reliably parse and process them.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL publish messages to the `raw-news` topic containing at minimum: a unique article ID, source URL, title, body text, source name, and ISO 8601 publication timestamp.
2. WHEN a message is published to `raw-news`, THE Ingestion_Service SHALL serialize it as valid JSON.
3. THE Ingestion_Service SHALL include a schema version field in every published message to support forward compatibility.
4. FOR ALL valid raw news objects, serializing then deserializing SHALL produce an equivalent object (round-trip property).

---

### Requirement 3: BERT-Based Caste-Bias Analysis

**User Story:** As a researcher, I want each ingested article to be automatically analyzed for caste-bias content, so that I can identify and monitor biased reporting patterns at scale.

#### Acceptance Criteria

1. WHEN a message is available on the `raw-news` Kafka topic, THE Analysis_Service SHALL consume it and run BERT-based caste-bias inference on the article body text.
2. THE Analysis_Service SHALL produce a Bias_Score in the range [0.0, 1.0] for each analyzed article.
3. WHEN analysis is complete, THE Analysis_Service SHALL publish the original article fields plus the Bias_Score and a bias classification label to the `analyzed-news` Kafka topic.
4. THE Analysis_Service SHALL persist each analyzed article record, including its Bias_Score, to PostgreSQL.
5. IF the BERT model inference fails for an article, THEN THE Analysis_Service SHALL publish the article to `analyzed-news` with a null Bias_Score and an error flag, rather than dropping the message.
6. THE Analysis_Service SHALL expose a REST endpoint (`GET /health`) that returns the service status and model load state.
7. WHEN the Analysis_Service starts, THE Analysis_Service SHALL load the BERT model into memory before consuming any Kafka messages.

---

### Requirement 4: Analyzed News Kafka Message Schema

**User Story:** As a developer building the prediction pipeline, I want analyzed news messages to carry bias annotations alongside the original article data, so that downstream services can make decisions based on bias scores.

#### Acceptance Criteria

1. THE Analysis_Service SHALL publish messages to the `analyzed-news` topic containing all fields from the original `raw-news` message plus: Bias_Score, bias classification label, and analysis timestamp.
2. WHEN a message is published to `analyzed-news`, THE Analysis_Service SHALL serialize it as valid JSON.
3. THE Analysis_Service SHALL include a schema version field in every published `analyzed-news` message.
4. FOR ALL valid analyzed news objects, serializing then deserializing SHALL produce an equivalent object (round-trip property).

---

### Requirement 5: Burst Detection and Trend Forecasting

**User Story:** As an analyst, I want the system to automatically detect surges in article volume for specific topics and forecast emerging trends, so that I can proactively respond to breaking news events.

#### Acceptance Criteria

1. WHEN messages are available on the `analyzed-news` Kafka topic, THE Prediction_Service SHALL consume them and apply Apache Flink streaming operators to detect Burst_Events.
2. THE Prediction_Service SHALL detect a Burst_Event when the article volume for a topic exceeds a configurable threshold within a configurable sliding time window.
3. WHEN a Burst_Event is detected, THE Prediction_Service SHALL publish a Burst_Event record to the `predictions` Kafka topic within 5 seconds of the triggering condition being met.
4. THE Prediction_Service SHALL produce Trend_Forecast records based on historical article volume patterns and publish them to the `predictions` Kafka topic.
5. THE Prediction_Service SHALL persist Burst_Event and Trend_Forecast records to PostgreSQL.
6. IF the `analyzed-news` topic is temporarily unavailable, THEN THE Prediction_Service SHALL resume processing from the last committed Kafka offset when connectivity is restored, without data loss.
7. THE Prediction_Service SHALL expose a health check endpoint that reports Flink job status.

---

### Requirement 6: Predictions Kafka Message Schema

**User Story:** As a developer building the alerting layer, I want prediction messages to carry structured burst and forecast data, so that the API Gateway can route alerts accurately.

#### Acceptance Criteria

1. THE Prediction_Service SHALL publish Burst_Event messages to the `predictions` topic containing: event ID, topic name, article count, time window start/end, and detection timestamp.
2. THE Prediction_Service SHALL publish Trend_Forecast messages to the `predictions` topic containing: forecast ID, topic name, predicted volume, confidence score, and forecast horizon timestamp.
3. WHEN a message is published to `predictions`, THE Prediction_Service SHALL serialize it as valid JSON.
4. FOR ALL valid Burst_Event objects, serializing then deserializing SHALL produce an equivalent object (round-trip property).
5. FOR ALL valid Trend_Forecast objects, serializing then deserializing SHALL produce an equivalent object (round-trip property).

---

### Requirement 7: API Gateway — WebSocket and REST

**User Story:** As a frontend developer, I want a single API Gateway that manages WebSocket connections and exposes REST endpoints, so that the dashboard can receive real-time updates and query historical data through one interface.

#### Acceptance Criteria

1. THE API_Gateway SHALL consume messages from the `predictions` Kafka topic and forward them to all connected WebSocket clients in real time.
2. WHEN a Dashboard_UI client establishes a WebSocket connection, THE API_Gateway SHALL register the session in Redis and begin streaming prediction events to that client.
3. WHEN a WebSocket client disconnects, THE API_Gateway SHALL remove the session from Redis and release associated resources.
4. THE API_Gateway SHALL expose REST endpoints for querying historical articles, bias scores, and prediction records stored in PostgreSQL.
5. WHEN a REST request is received, THE API_Gateway SHALL respond within 500ms for queries returning up to 100 records.
6. IF a WebSocket client sends an invalid or unauthorized message, THEN THE API_Gateway SHALL close the connection with an appropriate error code and log the event.
7. THE API_Gateway SHALL support at least 500 concurrent WebSocket connections without degradation of message delivery latency.
8. WHEN the API_Gateway starts, THE API_Gateway SHALL verify connectivity to Kafka, PostgreSQL, and Redis before accepting client connections.

---

### Requirement 8: User Session Management

**User Story:** As a system operator, I want user sessions to be managed securely and efficiently, so that the dashboard remains responsive and session state is not lost during transient failures.

#### Acceptance Criteria

1. THE API_Gateway SHALL store active WebSocket session state in Redis with a configurable time-to-live (TTL).
2. WHEN a session TTL expires without reconnection, THE API_Gateway SHALL remove the session record from Redis.
3. WHILE a user session is active, THE API_Gateway SHALL maintain the WebSocket connection and continue delivering prediction events without interruption.
4. IF Redis becomes unavailable, THEN THE API_Gateway SHALL continue serving existing WebSocket connections using in-memory session state and log a degraded-mode warning.

---

### Requirement 9: Real-Time Dashboard Visualization

**User Story:** As a news analyst, I want a real-time dashboard that displays bias heatmaps and controversy alerts, so that I can monitor emerging bias patterns and trending topics at a glance.

#### Acceptance Criteria

1. WHEN the Dashboard_UI loads, THE Dashboard_UI SHALL establish a WebSocket connection to the API_Gateway and display a connection status indicator.
2. WHEN a Burst_Event message is received over WebSocket, THE Dashboard_UI SHALL display a Controversy_Alert notification within 1 second of receipt.
3. THE Dashboard_UI SHALL render a Heatmap that updates in real time as new bias-scored articles arrive.
4. WHEN a Trend_Forecast message is received, THE Dashboard_UI SHALL update the trend visualization panel to reflect the new forecast data.
5. IF the WebSocket connection is lost, THE Dashboard_UI SHALL display a reconnection indicator and attempt to re-establish the connection automatically.
6. THE Dashboard_UI SHALL display article metadata (title, source, publication timestamp, Bias_Score) for articles surfaced in the heatmap.
7. WHEN a user clicks on a heatmap region, THE Dashboard_UI SHALL display a filtered list of articles associated with that region.

---

### Requirement 10: Data Persistence and Archival

**User Story:** As a data engineer, I want all processed articles, bias scores, and predictions to be persisted to PostgreSQL, so that historical analysis and auditing are possible.

#### Acceptance Criteria

1. THE Analysis_Service SHALL persist every analyzed article record to PostgreSQL, including article ID, source, title, body, Bias_Score, classification label, and analysis timestamp.
2. THE Prediction_Service SHALL persist every Burst_Event and Trend_Forecast record to PostgreSQL, including all fields defined in Requirement 6.
3. THE API_Gateway SHALL persist WebSocket event delivery logs to PostgreSQL for audit purposes.
4. WHEN a database write fails, THE Analysis_Service SHALL retry the write up to 3 times with exponential backoff before logging a persistent failure.
5. WHEN a database write fails, THE Prediction_Service SHALL retry the write up to 3 times with exponential backoff before logging a persistent failure.
6. THE PostgreSQL schema SHALL enforce referential integrity between articles, bias records, and prediction records.

---

### Requirement 11: Inter-Service Communication via Kafka

**User Story:** As a platform engineer, I want all inter-service communication to flow through Kafka topics, so that services are decoupled and the pipeline can be scaled independently.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL communicate with downstream services exclusively through the `raw-news` Kafka topic.
2. THE Analysis_Service SHALL consume exclusively from `raw-news` and publish exclusively to `analyzed-news`.
3. THE Prediction_Service SHALL consume exclusively from `analyzed-news` and publish exclusively to `predictions`.
4. THE API_Gateway SHALL consume exclusively from `predictions` for real-time event delivery.
5. WHEN a Kafka consumer group falls behind by more than a configurable lag threshold, THE system SHALL emit a lag alert to the monitoring log.
6. THE Kafka topics `raw-news`, `analyzed-news`, and `predictions` SHALL each be configured with a minimum of 3 partitions to support parallel consumption.

---

### Requirement 12: Service Health and Observability

**User Story:** As a DevOps engineer, I want each microservice to expose health check endpoints and structured logs, so that I can monitor system health and diagnose failures quickly.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL expose a `GET /health` endpoint returning HTTP 200 when the service is operational.
2. THE Analysis_Service SHALL expose a `GET /health` endpoint returning HTTP 200 when the service is operational and the BERT model is loaded.
3. THE Prediction_Service SHALL expose a health check endpoint returning the current Flink job status.
4. THE API_Gateway SHALL expose a `GET /health` endpoint returning HTTP 200 and connectivity status for Kafka, PostgreSQL, and Redis.
5. THE Dashboard_UI SHALL display a system health indicator reflecting the API_Gateway health status.
6. WHEN any service encounters an unhandled error, THE service SHALL emit a structured JSON log entry containing: timestamp, service name, error type, error message, and stack trace.
7. WHEN a service starts successfully, THE service SHALL emit a structured startup log entry confirming all dependencies are reachable.

---

### Requirement 13: Containerization and Orchestration

**User Story:** As a DevOps engineer, I want each microservice to be independently containerized and orchestrated via Docker Compose, so that the full system can be started, stopped, and scaled with a single command.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL include a Dockerfile that produces a runnable container image.
2. THE Analysis_Service SHALL include a Dockerfile that produces a runnable container image with the BERT model dependencies installed.
3. THE Prediction_Service SHALL include a Dockerfile that produces a runnable container image with the Apache Flink runtime.
4. THE API_Gateway SHALL include a Dockerfile that produces a runnable container image.
5. THE Dashboard_UI SHALL include a Dockerfile that produces a runnable container image.
6. THE system SHALL include a root-level `docker-compose.yml` that defines all five microservices, Kafka, PostgreSQL, and Redis with correct dependency ordering and network configuration.
7. WHEN `docker-compose up` is executed, THE system SHALL start all services and infrastructure components in dependency order, with Kafka and PostgreSQL available before any microservice begins processing.
8. WHERE a service requires environment-specific configuration, THE service SHALL read configuration from environment variables defined in the `docker-compose.yml` or a `.env` file.

---

### Requirement 14: Monorepo Structure

**User Story:** As a developer, I want the codebase organized as a monorepo with clear service boundaries, so that I can navigate, build, and deploy each service independently.

#### Acceptance Criteria

1. THE system SHALL organize source code in a monorepo with each microservice in its own top-level directory: `ingestion-service/`, `analysis-service/`, `prediction-service/`, `api-gateway/`, and `dashboard-ui/`.
2. THE system SHALL include a root-level `docker-compose.yml` for full-stack orchestration.
3. WHEN a developer builds a single service, THE build process SHALL not require building other services as a prerequisite.
4. THE system SHALL include a root-level README documenting how to start the full stack, run individual services, and configure environment variables.
