# Implementation Plan: AI News Reader and Predictor

## Overview

This plan implements a real-time distributed news analysis system as a monorepo of five independent microservices. Tasks are organized by service, each building incrementally from project scaffolding through core logic, persistence, health endpoints, and Dockerization. Cross-service wiring and E2E validation are handled in the final phase. Property-based tests are placed immediately after the components they validate.

## Tasks

- [x] 1. Monorepo root scaffolding and shared infrastructure configuration
  - Create root-level `README.md` documenting full-stack startup, per-service build commands, and environment variable reference
  - Create root-level `.env.example` listing all required environment variables for all services (Kafka brokers, DB credentials, Redis URL, model paths, thresholds)
  - Create `docker-compose.yml` defining Zookeeper, Kafka (3 partitions on `raw-news`, `analyzed-news`, `predictions`), PostgreSQL, and Redis with health checks and dependency ordering; microservice stubs to be filled in later tasks
  - Create `init-db/01_schema.sql` with PostgreSQL DDL: `articles`, `bias_records`, `burst_events`, `trend_forecasts`, `ws_event_log` tables with referential integrity constraints and indexes
  - _Requirements: 11.6, 13.6, 13.7, 13.8, 14.1, 14.2, 14.4, 10.6_

- [x] 2. ingestion-service — project structure and core types
  - Create `ingestion-service/package.json` with TypeScript, KafkaJS, axios, uuid, winston dependencies (pinned versions)
  - Create `ingestion-service/tsconfig.json` with strict mode enabled
  - Create `ingestion-service/src/types/RawNewsMessage.ts` defining the `RawNewsMessage` interface: `articleId`, `sourceUrl`, `title`, `body`, `sourceName`, `publishedAt` (ISO 8601), `schemaVersion`
  - Create `ingestion-service/src/utils/validate.ts` implementing `validateRawArticle(input: unknown): RawNewsMessage` that throws on missing required fields (title, source, timestamp)
  - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3_

  - [x] 2.1 Implement Kafka producer module
    - Create `ingestion-service/src/kafka/producer.ts` wrapping KafkaJS producer with connect/disconnect lifecycle, publish-to-`raw-news`, and in-memory buffer (configurable limit) for when Kafka is unavailable
    - Implement exponential-backoff reconnect logic in the producer
    - _Requirements: 1.1, 1.6, 11.1_

  - [ ]* 2.2 Write property test for RawNewsMessage serialization round-trip
    - Install `fast-check` as a dev dependency in `ingestion-service`
    - Create `ingestion-service/src/__tests__/rawNews.property.test.ts`
    - **Property 2: Raw News Serialization Round-Trip** — generate arbitrary valid `RawNewsMessage` objects, serialize to JSON, deserialize, assert deep equality
    - **Validates: Requirements 2.4**

  - [ ]* 2.3 Write property test for ingestion field completeness
    - Create `ingestion-service/src/__tests__/ingestionFields.property.test.ts`
    - **Property 1: Ingestion Publishes All Required Fields** — for any valid article input, assert the produced Kafka message contains all seven required fields and is valid JSON
    - **Validates: Requirements 1.1, 1.5, 2.1, 2.2, 2.3**

  - [ ]* 2.4 Write property test for malformed article rejection
    - Create `ingestion-service/src/__tests__/validation.property.test.ts`
    - **Property 3: Ingestion Rejects Malformed Articles** — generate articles with one or more required fields removed; assert `validateRawArticle` throws and no Kafka publish is called
    - **Validates: Requirements 1.4**

  - [ ]* 2.5 Write property test for unique identifier assignment
    - Create `ingestion-service/src/__tests__/uniqueId.property.test.ts`
    - **Property 4: Ingestion Assigns Unique Identifiers** — generate N (up to 1000) valid articles, assign IDs, assert all IDs are distinct
    - **Validates: Requirements 1.5**

- [x] 3. ingestion-service — stream connectors and health endpoint
  - Create `ingestion-service/src/connectors/newsApiConnector.ts` implementing HTTP polling of a news API with exponential-backoff reconnect on connection loss and structured error logging on disconnect
  - Create `ingestion-service/src/connectors/socialStreamConnector.ts` implementing WebSocket-based social media stream consumption with the same reconnect pattern
  - Create `ingestion-service/src/health/healthRouter.ts` exposing `GET /health` returning HTTP 200 with service status JSON
  - Create `ingestion-service/src/index.ts` wiring connectors → validator → producer, emitting structured startup log on successful dependency connection
  - _Requirements: 1.2, 1.3, 1.6, 12.1, 12.6, 12.7_

- [x] 4. ingestion-service — Dockerfile
  - Create `ingestion-service/Dockerfile` using a Node.js LTS base image, multi-stage build (build stage compiles TypeScript, runtime stage copies dist), non-root user, EXPOSE health port
  - Update root `docker-compose.yml` to add the `ingestion-service` service definition with environment variables, depends_on Kafka, and health check
  - _Requirements: 13.1, 13.6, 13.8_

- [x] 5. Checkpoint — ingestion-service
  - Ensure all ingestion-service tests pass, TypeScript compiles without errors, and the Docker image builds successfully. Ask the user if questions arise.

- [x] 6. analysis-service — project structure and core types
  - Create `analysis-service/requirements.txt` with pinned versions: fastapi, uvicorn, kafka-python, transformers, torch, psycopg2-binary, pydantic, tenacity, hypothesis (for property tests)
  - Create `analysis-service/app/models/schemas.py` defining Pydantic models: `RawNewsMessage`, `AnalyzedNewsMessage` (extends raw with `biasScore: float`, `biasLabel: str`, `analysisTimestamp: str`, `schemaVersion: str`, `errorFlag: bool`)
  - Create `analysis-service/app/utils/validate.py` with field validation helpers
  - _Requirements: 3.2, 3.3, 4.1, 4.2, 4.3_

  - [x] 6.1 Implement BERT inference module
    - Create `analysis-service/app/ml/bert_classifier.py` loading a HuggingFace BERT model for caste-bias classification, exposing `predict(text: str) -> tuple[float, str]` returning `(bias_score, label)`
    - Implement model-load-before-consume guard: raise `RuntimeError` if inference is called before model is loaded
    - _Requirements: 3.1, 3.2, 3.7_

  - [ ]* 6.2 Write property test for bias score range
    - Create `analysis-service/tests/test_bias_score_property.py`
    - **Property 5: Bias Score Is a Valid Probability** — use Hypothesis to generate arbitrary text strings, run through `predict()`, assert `0.0 <= bias_score <= 1.0`
    - **Validates: Requirements 3.2**

  - [x] 6.3 Implement Kafka consumer and producer for analysis pipeline
    - Create `analysis-service/app/kafka/consumer.py` consuming from `raw-news` topic, deserializing JSON, calling BERT inference, and publishing to `analyzed-news`
    - Implement error handling: on inference failure, publish article with `biasScore=null` and `errorFlag=true` rather than dropping
    - _Requirements: 3.1, 3.3, 3.5, 11.2_

  - [ ]* 6.4 Write property test for analyzed message field preservation
    - Create `analysis-service/tests/test_analyzed_fields_property.py`
    - **Property 6: Analyzed News Message Preserves and Extends Original Fields** — generate arbitrary valid `RawNewsMessage` objects, run through analysis pipeline mock, assert all original fields present plus bias annotations
    - **Validates: Requirements 3.3, 4.1, 4.2, 4.3**

  - [ ]* 6.5 Write property test for analyzed news serialization round-trip
    - Create `analysis-service/tests/test_analyzed_roundtrip_property.py`
    - **Property 7: Analyzed News Serialization Round-Trip** — generate arbitrary valid `AnalyzedNewsMessage` objects, serialize to JSON, deserialize, assert equivalence
    - **Validates: Requirements 4.4**

- [x] 7. analysis-service — PostgreSQL persistence and retry logic
  - Create `analysis-service/app/db/repository.py` implementing `save_analyzed_article(record)` using psycopg2 with `tenacity` retry decorator (3 retries, exponential backoff), logging persistent failure after exhaustion
  - Create `analysis-service/app/db/connection.py` managing PostgreSQL connection pool
  - _Requirements: 3.4, 10.1, 10.4_

  - [ ]* 7.1 Write property test for database write retry behavior
    - Create `analysis-service/tests/test_db_retry_property.py`
    - **Property 17: Database Write Retry on Failure** — mock DB to fail N times then succeed; assert total call count equals N+1 and does not exceed 4; test for N in {1,2,3}
    - **Validates: Requirements 10.4**

- [x] 8. analysis-service — FastAPI app, health endpoint, and startup sequence
  - Create `analysis-service/app/main.py` wiring FastAPI app, lifespan handler that loads BERT model before starting Kafka consumer, and `GET /health` endpoint returning service status and model load state
  - Implement structured JSON logging for unhandled errors (timestamp, service name, error type, message, stack trace) and startup confirmation log
  - _Requirements: 3.6, 3.7, 12.2, 12.6, 12.7_

- [x] 9. analysis-service — Dockerfile
  - Create `analysis-service/Dockerfile` using a Python 3.11 slim base, installing requirements.txt, copying app, non-root user, EXPOSE port
  - Update root `docker-compose.yml` to add `analysis-service` with environment variables, depends_on Kafka and PostgreSQL, and health check
  - _Requirements: 13.2, 13.6, 13.8_

- [x] 10. Checkpoint — analysis-service
  - Ensure all analysis-service tests pass (including Hypothesis property tests), the FastAPI app starts without errors, and the Docker image builds. Ask the user if questions arise.

- [x] 11. prediction-service — project structure and Maven build
  - Create `prediction-service/pom.xml` with dependencies: Apache Flink (flink-streaming-java, flink-connector-kafka), Jackson (for JSON), PostgreSQL JDBC driver, JUnit 5, jqwik (property-based testing library)
  - Create `prediction-service/src/main/java/com/ainews/prediction/model/BurstEvent.java` POJO with fields: `eventId`, `topicName`, `articleCount`, `windowStart`, `windowEnd`, `detectionTimestamp`
  - Create `prediction-service/src/main/java/com/ainews/prediction/model/TrendForecast.java` POJO with fields: `forecastId`, `topicName`, `predictedVolume`, `confidenceScore`, `forecastHorizon`
  - Create `prediction-service/src/main/java/com/ainews/prediction/model/AnalyzedNewsMessage.java` POJO mirroring the `analyzed-news` schema
  - _Requirements: 5.1, 6.1, 6.2_

  - [ ]* 11.1 Write property test for BurstEvent serialization round-trip
    - Create `prediction-service/src/test/java/com/ainews/prediction/BurstEventRoundTripTest.java`
    - **Property 11: Burst Event Serialization Round-Trip** — use jqwik `@Property` to generate arbitrary `BurstEvent` instances, serialize to JSON via Jackson, deserialize, assert field equality
    - **Validates: Requirements 6.4**

  - [ ]* 11.2 Write property test for TrendForecast serialization round-trip
    - Create `prediction-service/src/test/java/com/ainews/prediction/TrendForecastRoundTripTest.java`
    - **Property 12: Trend Forecast Serialization Round-Trip** — use jqwik `@Property` to generate arbitrary `TrendForecast` instances, serialize to JSON, deserialize, assert field equality
    - **Validates: Requirements 6.5**

  - [ ]* 11.3 Write property test for predictions message schema completeness
    - Create `prediction-service/src/test/java/com/ainews/prediction/PredictionsSchemaTest.java`
    - **Property 10: Predictions Message Schema Completeness** — generate arbitrary `BurstEvent` and `TrendForecast` objects, serialize to JSON, parse JSON node, assert all required fields present and non-null
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 12. prediction-service — Flink burst detection operator
  - Create `prediction-service/src/main/java/com/ainews/prediction/operators/BurstDetectionOperator.java` implementing a Flink `ProcessWindowFunction` over a configurable sliding time window, emitting `BurstEvent` when article count exceeds configurable threshold
  - Create `prediction-service/src/main/java/com/ainews/prediction/operators/TrendForecastOperator.java` implementing a Flink operator that produces `TrendForecast` records from historical volume patterns
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 12.1 Write property test for burst detection threshold
    - Create `prediction-service/src/test/java/com/ainews/prediction/BurstDetectionPropertyTest.java`
    - **Property 9: Burst Detection Triggers on Threshold Breach** — use jqwik to generate article streams where volume exceeds threshold within window; assert at least one `BurstEvent` is emitted; also test streams below threshold produce no events
    - **Validates: Requirements 5.1, 5.2**

- [x] 13. prediction-service — Kafka source, sink, and PostgreSQL persistence
  - Create `prediction-service/src/main/java/com/ainews/prediction/kafka/KafkaSourceConfig.java` configuring Flink Kafka consumer for `analyzed-news` with committed-offset resume on restart
  - Create `prediction-service/src/main/java/com/ainews/prediction/kafka/KafkaSinkConfig.java` configuring Flink Kafka producer for `predictions` topic
  - Create `prediction-service/src/main/java/com/ainews/prediction/db/PredictionRepository.java` implementing JDBC persistence for `BurstEvent` and `TrendForecast` with retry logic (3 retries, exponential backoff)
  - _Requirements: 5.3, 5.5, 5.6, 10.2, 10.5, 11.3_

  - [ ]* 13.1 Write property test for prediction persistence retry behavior
    - Create `prediction-service/src/test/java/com/ainews/prediction/DbRetryPropertyTest.java`
    - **Property 17 (Prediction_Service): Database Write Retry on Failure** — mock JDBC to fail N times then succeed; assert total attempts equals N+1 and does not exceed 4
    - **Validates: Requirements 10.5**

- [x] 14. prediction-service — main Flink job, health endpoint, and structured logging
  - Create `prediction-service/src/main/java/com/ainews/prediction/PredictionJob.java` wiring Flink `StreamExecutionEnvironment`, Kafka source → burst detection → trend forecast → Kafka sink → DB sink
  - Create `prediction-service/src/main/java/com/ainews/prediction/health/HealthServer.java` exposing a lightweight HTTP health endpoint reporting Flink job status
  - Implement structured JSON error logging and startup confirmation log
  - _Requirements: 5.7, 12.3, 12.6, 12.7_

- [x] 15. prediction-service — Dockerfile
  - Create `prediction-service/Dockerfile` using a Maven build stage to produce a fat JAR, then a JRE 17 slim runtime stage; non-root user; EXPOSE health port
  - Update root `docker-compose.yml` to add `prediction-service` with environment variables, depends_on Kafka and PostgreSQL, and health check
  - _Requirements: 13.3, 13.6, 13.8_

- [x] 16. Checkpoint — prediction-service
  - Ensure all prediction-service tests pass (including jqwik property tests), the Maven build succeeds, and the Docker image builds. Ask the user if questions arise.

- [x] 17. api-gateway — project structure and core modules
  - Create `api-gateway/package.json` with NestJS, `@nestjs/websockets`, `@nestjs/platform-socket.io`, KafkaJS, ioredis, pg, class-validator, class-transformer, winston (pinned versions)
  - Create `api-gateway/tsconfig.json` with strict mode and NestJS decorator support
  - Create `api-gateway/src/app.module.ts` importing all feature modules
  - Create `api-gateway/src/config/configuration.ts` loading all environment variables (Kafka brokers, DB URL, Redis URL, session TTL, WebSocket port)
  - _Requirements: 7.1, 7.2, 7.4, 8.1, 13.8_

  - [x] 17.1 Implement WebSocket gateway module
    - Create `api-gateway/src/websocket/websocket.gateway.ts` implementing NestJS `@WebSocketGateway` with `handleConnection` (register session in Redis with TTL) and `handleDisconnect` (remove session from Redis) handlers
    - Implement in-memory session fallback when Redis is unavailable, with degraded-mode warning log
    - _Requirements: 7.2, 7.3, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 17.2 Write property test for WebSocket session lifecycle
    - Install `fast-check` as a dev dependency in `api-gateway`
    - Create `api-gateway/src/__tests__/sessionLifecycle.property.test.ts`
    - **Property 14: WebSocket Session Lifecycle Round-Trip** — simulate N connect/disconnect cycles; assert session present in Redis after connect and absent after disconnect for all N cycles
    - **Validates: Requirements 7.2, 7.3, 8.1, 8.2**

  - [x] 17.3 Implement Kafka consumer and prediction broadcast module
    - Create `api-gateway/src/kafka/kafka-consumer.service.ts` consuming from `predictions` topic and calling `broadcastToAllClients(message)` on the WebSocket gateway
    - _Requirements: 7.1, 11.4_

  - [ ]* 17.4 Write property test for prediction event broadcast
    - Create `api-gateway/src/__tests__/broadcast.property.test.ts`
    - **Property 15: Prediction Events Are Forwarded to All Connected Clients** — register N mock WebSocket clients; publish M prediction messages; assert each client received exactly M messages
    - **Validates: Requirements 7.1**

  - [x] 17.5 Implement invalid message handler and connection closure
    - Create `api-gateway/src/websocket/message-validator.ts` validating incoming WebSocket messages; on invalid/unauthorized message, close connection with error code and remove session from registry
    - _Requirements: 7.6_

  - [ ]* 17.6 Write property test for invalid WebSocket message handling
    - Create `api-gateway/src/__tests__/invalidMessage.property.test.ts`
    - **Property 16: Invalid WebSocket Messages Cause Connection Closure** — generate arbitrary invalid message payloads; assert connection is closed and client no longer appears in active session registry
    - **Validates: Requirements 7.6**

- [x] 18. api-gateway — REST endpoints and PostgreSQL queries
  - Create `api-gateway/src/articles/articles.controller.ts` and `articles.service.ts` implementing `GET /articles` (with pagination, max 100 records), `GET /articles/:id`, `GET /bias-scores`, `GET /predictions` querying PostgreSQL
  - Create `api-gateway/src/db/db.service.ts` managing PostgreSQL connection pool
  - Implement WebSocket event delivery audit log writes to `ws_event_log` table
  - _Requirements: 7.4, 7.5, 10.3_

- [x] 19. api-gateway — health endpoint and startup dependency verification
  - Create `api-gateway/src/health/health.controller.ts` implementing `GET /health` that checks connectivity to Kafka, PostgreSQL, and Redis before returning HTTP 200 with status JSON
  - Implement startup guard in `main.ts` that verifies all three dependencies before accepting connections, emitting structured startup log on success
  - Implement structured JSON error logging for unhandled exceptions
  - _Requirements: 7.8, 12.4, 12.6, 12.7_

- [x] 20. api-gateway — Dockerfile
  - Create `api-gateway/Dockerfile` using Node.js LTS multi-stage build (build → runtime), non-root user, EXPOSE WebSocket and HTTP ports
  - Update root `docker-compose.yml` to add `api-gateway` with environment variables, depends_on Kafka, PostgreSQL, Redis, and health check
  - _Requirements: 13.4, 13.6, 13.8_

- [x] 21. Checkpoint — api-gateway
  - Ensure all api-gateway tests pass, TypeScript compiles without errors, and the Docker image builds. Ask the user if questions arise.

- [x] 22. dashboard-ui — project structure and core configuration
  - Create `dashboard-ui/package.json` with Next.js, React, Tailwind CSS, socket.io-client, recharts (or similar charting library), fast-check (dev), jest, @testing-library/react (pinned versions)
  - Create `dashboard-ui/tailwind.config.ts` and `dashboard-ui/postcss.config.js`
  - Create `dashboard-ui/tsconfig.json` with strict mode
  - Create `dashboard-ui/src/lib/websocket.ts` implementing a WebSocket client singleton with auto-reconnect logic and connection status tracking
  - _Requirements: 9.1, 9.5_

  - [x] 22.1 Implement WebSocket connection status indicator component
    - Create `dashboard-ui/src/components/ConnectionStatus.tsx` displaying connected/disconnected/reconnecting states, updating reactively from WebSocket client state
    - _Requirements: 9.1, 9.5_

  - [x] 22.2 Implement Controversy Alert component
    - Create `dashboard-ui/src/components/ControversyAlert.tsx` rendering a notification banner/toast when a `BurstEvent` message is received; notification must render within 1 second of receipt
    - _Requirements: 9.2_

  - [ ]* 22.3 Write property test for controversy alert rendering
    - Create `dashboard-ui/src/__tests__/controversyAlert.property.test.ts`
    - **Property 18: Controversy Alert Displayed for Every Burst Event** — use fast-check to generate N arbitrary `BurstEvent` payloads; simulate WebSocket message receipt; assert a `ControversyAlert` is rendered for each event
    - **Validates: Requirements 9.2**

  - [x] 22.4 Implement Heatmap component
    - Create `dashboard-ui/src/components/Heatmap.tsx` rendering a real-time heatmap of bias-scored articles, updating as new articles arrive over WebSocket; each article cell displays title, source, publication timestamp, and Bias_Score
    - _Requirements: 9.3, 9.6_

  - [ ]* 22.5 Write property test for heatmap article metadata display
    - Create `dashboard-ui/src/__tests__/heatmapMetadata.property.test.ts`
    - **Property 19: Heatmap Displays Correct Article Metadata** — generate arbitrary article objects with title, source, publishedAt, biasScore; render Heatmap; assert all four fields are present in the rendered output for each article
    - **Validates: Requirements 9.3, 9.6**

  - [x] 22.6 Implement heatmap region filter
    - Create `dashboard-ui/src/components/ArticleFilterPanel.tsx` rendering a filtered article list when a heatmap region is clicked; only articles belonging to the selected region are shown
    - _Requirements: 9.7_

  - [ ]* 22.7 Write property test for heatmap region filter correctness
    - Create `dashboard-ui/src/__tests__/heatmapFilter.property.test.ts`
    - **Property 20: Heatmap Region Filter Returns Only Matching Articles** — generate articles distributed across N regions; select a region; assert all displayed articles belong to that region and no articles from other regions appear
    - **Validates: Requirements 9.7**

  - [x] 22.8 Implement Trend Visualization panel
    - Create `dashboard-ui/src/components/TrendPanel.tsx` rendering a line/area chart of trend forecasts; updates when a `TrendForecast` WebSocket message is received, with displayed values matching the received forecast data
    - _Requirements: 9.4_

  - [ ]* 22.9 Write property test for trend visualization update
    - Create `dashboard-ui/src/__tests__/trendPanel.property.test.ts`
    - **Property 21: Trend Visualization Updates on Forecast Receipt** — generate arbitrary `TrendForecast` messages; simulate WebSocket receipt; assert the rendered chart reflects the new forecast values
    - **Validates: Requirements 9.4**

- [x] 23. dashboard-ui — main page and system health indicator
  - Create `dashboard-ui/src/app/page.tsx` (Next.js App Router) composing `ConnectionStatus`, `ControversyAlert`, `Heatmap`, `ArticleFilterPanel`, and `TrendPanel` components
  - Create `dashboard-ui/src/components/SystemHealthIndicator.tsx` polling `GET /health` on the API Gateway and displaying system health status
  - _Requirements: 9.1, 12.5_

- [x] 24. dashboard-ui — Dockerfile
  - Create `dashboard-ui/Dockerfile` using a Node.js LTS multi-stage build (deps → build → runtime with Next.js standalone output), non-root user, EXPOSE port 3000
  - Update root `docker-compose.yml` to add `dashboard-ui` with environment variables (API Gateway URL), depends_on api-gateway, and health check
  - _Requirements: 13.5, 13.6, 13.8_

- [x] 25. Checkpoint — dashboard-ui
  - Ensure all dashboard-ui tests pass, Next.js builds without errors, and the Docker image builds. Ask the user if questions arise.

- [x] 26. Structured error logging — cross-service validation
  - Verify each service emits a structured JSON log entry on unhandled errors containing: `timestamp`, `serviceName`, `errorType`, `errorMessage`, `stackTrace`
  - Create `ingestion-service/src/utils/logger.ts`, `analysis-service/app/utils/logger.py`, `api-gateway/src/utils/logger.ts` (prediction-service uses SLF4J JSON appender) implementing the shared log schema
  - _Requirements: 12.6_

  - [ ]* 26.1 Write property test for structured error log schema
    - Create `ingestion-service/src/__tests__/errorLog.property.test.ts` (representative; pattern applies to all services)
    - **Property 22: Structured Error Log Contains Required Fields** — use fast-check to generate arbitrary error objects; pass through logger; parse emitted JSON; assert all five required fields present
    - **Validates: Requirements 12.6**

- [x] 27. Kafka topic initialization and lag monitoring
  - Create `kafka-init/create-topics.sh` script that creates `raw-news`, `analyzed-news`, and `predictions` topics each with 3 partitions and replication factor 1 (dev) via `kafka-topics.sh`
  - Add Kafka lag monitoring: implement a lag-check utility in `ingestion-service/src/utils/lagMonitor.ts` that emits a structured warning log when consumer group lag exceeds a configurable threshold
  - Update `docker-compose.yml` to run `kafka-init` as a one-shot init container after Kafka is healthy
  - _Requirements: 11.5, 11.6_

- [x] 28. Root docker-compose.yml — finalize all service definitions
  - Complete the root `docker-compose.yml` with all five microservices, Kafka, Zookeeper, PostgreSQL, Redis, and the kafka-init container
  - Ensure correct `depends_on` with `condition: service_healthy` for all dependency ordering
  - Mount `init-db/01_schema.sql` into the PostgreSQL container for automatic schema initialization
  - Add a shared `monitoring` network and configure all services to use it
  - _Requirements: 13.6, 13.7, 13.8, 14.2_

- [x] 29. Cross-service E2E validation script
  - Create `e2e/validate-pipeline.sh` (or `e2e/validate-pipeline.ts` run via `ts-node`) that:
    1. Waits for all five service health endpoints to return HTTP 200
    2. POSTs a synthetic news article to the ingestion-service (or directly to `raw-news` Kafka topic)
    3. Polls `analyzed-news` Kafka topic and asserts a message with a valid `biasScore` appears within 30 seconds
    4. Polls `predictions` Kafka topic and asserts a `BurstEvent` or `TrendForecast` appears within 60 seconds
    5. Connects a WebSocket client to the API Gateway and asserts a prediction event is received
    6. Queries the API Gateway REST endpoint and asserts the article appears in the historical records
    7. Exits 0 on full pipeline success, 1 on any assertion failure with a descriptive error message
  - Create `e2e/README.md` documenting how to run the E2E script against a running `docker-compose up` stack
  - _Requirements: 1.1, 3.1, 5.1, 7.1, 7.4, 14.1_

- [x] 30. Final checkpoint — full stack
  - Run `docker-compose build` and verify all five images build without errors
  - Run all unit and property-based tests across all services
  - Verify the E2E script exits 0 against a running stack
  - Ensure all tests pass and ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- Each task references specific requirements for traceability
- Property tests use: `fast-check` (TypeScript services), `Hypothesis` (Python), `jqwik` (Java)
- Checkpoints at tasks 5, 10, 16, 21, 25, and 30 ensure incremental validation at service boundaries
- The root `docker-compose.yml` is built incrementally — each service task adds its definition
- The E2E script in task 29 validates the complete data flow: ingestion → analysis → prediction → gateway → UI
