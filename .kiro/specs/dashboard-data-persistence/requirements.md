# Requirements Document

## Introduction

The dashboard currently holds all data exclusively in React component state. Every page refresh or new tab open results in a blank dashboard that must wait for live WebSocket messages before displaying any content. This feature adds persistence so that recent articles, burst events, and trend forecasts are immediately visible on load, with live WebSocket updates layered on top as they arrive.

The solution has two layers:
1. **API hydration** — on page load, the Dashboard_UI fetches recent records from the existing REST endpoints (`/articles`, `/predictions`) exposed by the API_Gateway, which reads from PostgreSQL.
2. **localStorage caching** — the Dashboard_UI also writes a lightweight snapshot to `localStorage` so that a subsequent load can render data instantly while the API fetch is in flight.

Live WebSocket updates continue to arrive and are merged into the hydrated state, deduplicating by ID.

---

## Glossary

- **Dashboard_UI**: The Next.js 14 front-end application running at port 3000.
- **API_Gateway**: The NestJS back-end service running at port 4000 that exposes REST endpoints and the WebSocket server.
- **Hydration**: The process of populating Dashboard_UI state from the API_Gateway REST endpoints on page load.
- **Article**: A news article record containing `articleId`, `title`, `sourceName`, `publishedAt`, and `biasScore`.
- **BurstEvent**: A topic-level burst detection record containing `eventId`, `topicName`, `articleCount`, `windowStart`, `windowEnd`, and `detectionTimestamp`.
- **TrendForecast**: A trend prediction record containing `forecastId`, `topicName`, `predictedVolume`, `confidenceScore`, and `forecastHorizon`.
- **Prediction**: A union of BurstEvent and TrendForecast records as returned by `GET /predictions`.
- **localStorage_Cache**: A browser `localStorage` entry keyed by a fixed string that stores a serialized snapshot of recent dashboard data.
- **Hydration_Client**: The module within Dashboard_UI responsible for fetching initial data from the API_Gateway.
- **Cache_Manager**: The module within Dashboard_UI responsible for reading and writing the localStorage_Cache.
- **Deduplication**: The process of merging incoming WebSocket records with already-loaded records, keeping only one copy per unique ID.

---

## Requirements

### Requirement 1: API Hydration on Page Load

**User Story:** As a dashboard user, I want to see recent articles, burst events, and trend forecasts immediately when I open or refresh the dashboard, so that I do not have to wait for live WebSocket messages to populate the view.

#### Acceptance Criteria

1. WHEN the Dashboard_UI page mounts, THE Hydration_Client SHALL fetch the most recent articles from `GET /articles` on the API_Gateway.
2. WHEN the Dashboard_UI page mounts, THE Hydration_Client SHALL fetch the most recent predictions (burst events and trend forecasts) from `GET /predictions` on the API_Gateway.
3. WHEN the API_Gateway returns articles, THE Dashboard_UI SHALL populate the articles list with the fetched records before any WebSocket message is processed.
4. WHEN the API_Gateway returns predictions, THE Dashboard_UI SHALL populate the burst events list and trend forecasts list with the fetched records before any WebSocket message is processed.
5. THE Hydration_Client SHALL request a maximum of 50 articles and 50 predictions on the initial page load.
6. WHEN a hydration fetch completes successfully, THE Dashboard_UI SHALL display the fetched data within 100 ms of receiving the API response.

---

### Requirement 2: Merging Live WebSocket Updates with Hydrated Data

**User Story:** As a dashboard user, I want live updates to appear on top of the already-loaded historical data, so that the dashboard stays current without duplicating records.

#### Acceptance Criteria

1. WHEN a WebSocket message arrives with an `articleId` that already exists in the articles list, THE Dashboard_UI SHALL ignore the duplicate and retain the existing record.
2. WHEN a WebSocket message arrives with an `articleId` that does not exist in the articles list, THE Dashboard_UI SHALL prepend the new article to the articles list.
3. WHEN a WebSocket message arrives with an `eventId` that already exists in the burst events list, THE Dashboard_UI SHALL ignore the duplicate and retain the existing record.
4. WHEN a WebSocket message arrives with a `forecastId` that already exists in the trend forecasts list, THE Dashboard_UI SHALL ignore the duplicate and retain the existing record.
5. THE Dashboard_UI SHALL maintain a maximum of 200 articles, 20 burst events, and 50 trend forecasts in memory at any time, discarding the oldest records when the limit is reached.

---

### Requirement 3: localStorage Snapshot Cache

**User Story:** As a dashboard user, I want the dashboard to render data instantly on load even before the API response arrives, so that I see content immediately rather than a blank screen.

#### Acceptance Criteria

1. WHEN a hydration fetch completes successfully, THE Cache_Manager SHALL write a snapshot of the current articles, burst events, and trend forecasts to localStorage_Cache.
2. WHEN a WebSocket message updates the dashboard state, THE Cache_Manager SHALL update the localStorage_Cache within 5 seconds of the state change.
3. WHEN the Dashboard_UI page mounts, THE Cache_Manager SHALL read the localStorage_Cache and pre-populate the dashboard state before the API hydration fetch completes.
4. WHEN the localStorage_Cache contains data, THE Dashboard_UI SHALL render that data within 50 ms of page mount.
5. IF the localStorage_Cache entry is malformed or cannot be parsed, THEN THE Cache_Manager SHALL discard the entry and proceed with an empty initial state.
6. IF the localStorage_Cache entry was written more than 24 hours ago, THEN THE Cache_Manager SHALL discard the entry and proceed with an empty initial state.
7. THE Cache_Manager SHALL store no more than 50 articles, 20 burst events, and 50 trend forecasts in the localStorage_Cache.

---

### Requirement 4: API Hydration Error Handling

**User Story:** As a dashboard user, I want the dashboard to remain functional even when the API hydration fetch fails, so that live WebSocket updates still appear and the dashboard does not show an error state.

#### Acceptance Criteria

1. IF the `GET /articles` fetch returns a non-2xx HTTP status, THEN THE Hydration_Client SHALL log the error and leave the articles list in its pre-fetch state (either empty or populated from localStorage_Cache).
2. IF the `GET /predictions` fetch returns a non-2xx HTTP status, THEN THE Hydration_Client SHALL log the error and leave the predictions lists in their pre-fetch state.
3. IF the `GET /articles` fetch does not respond within 5000 ms, THEN THE Hydration_Client SHALL abort the request and leave the articles list in its pre-fetch state.
4. IF the `GET /predictions` fetch does not respond within 5000 ms, THEN THE Hydration_Client SHALL abort the request and leave the predictions lists in their pre-fetch state.
5. WHEN a hydration fetch fails, THE Dashboard_UI SHALL continue to accept and display incoming WebSocket messages normally.
6. WHEN a hydration fetch fails, THE Dashboard_UI SHALL NOT display an error banner or block the user interface.

---

### Requirement 5: API Response Mapping

**User Story:** As a developer, I want the API response fields to be correctly mapped to the dashboard's internal data types, so that hydrated records render identically to records received over WebSocket.

#### Acceptance Criteria

1. WHEN the Hydration_Client receives an article record from `GET /articles`, THE Hydration_Client SHALL map `article_id` → `articleId`, `source_name` → `sourceName`, `published_at` → `publishedAt`, and `bias_score` (from the joined bias_records) → `biasScore`.
2. WHEN the Hydration_Client receives a prediction record of type `burst_event` from `GET /predictions`, THE Hydration_Client SHALL map `id` → `eventId`, `topic_name` → `topicName`, `article_count` → `articleCount`, `window_start` → `windowStart`, `window_end` → `windowEnd`, `created_at` → `detectionTimestamp`.
3. WHEN the Hydration_Client receives a prediction record of type `trend_forecast` from `GET /predictions`, THE Hydration_Client SHALL map `id` → `forecastId`, `topic_name` → `topicName`, `predicted_volume` → `predictedVolume`, `confidence_score` → `confidenceScore`, `forecast_horizon` → `forecastHorizon`.
4. WHEN a field in the API response is `null` or absent, THE Hydration_Client SHALL substitute the same default value used by the WebSocket message handler for that field.
5. THE Hydration_Client SHALL produce Article, BurstEvent, and TrendForecast objects that are structurally identical to those produced by the WebSocket message handler, so that both sources can be stored in the same state arrays without type divergence.

---

### Requirement 6: API Gateway — Bias Score Join for Articles Endpoint

**User Story:** As a developer, I want the `GET /articles` endpoint to include the bias score for each article, so that the dashboard can render the bias heatmap correctly from hydrated data.

#### Acceptance Criteria

1. WHEN `GET /articles` is called, THE API_Gateway SHALL return each article record joined with its most recent `bias_records` entry, including `bias_score` and `bias_label`.
2. WHEN an article has no corresponding `bias_records` entry, THE API_Gateway SHALL return `bias_score: null` and `bias_label: null` for that article.
3. THE API_Gateway SHALL return the joined result within the existing pagination contract (max 100 records per page, ordered by `published_at` descending).

---

### Requirement 7: Loading State Indicator

**User Story:** As a dashboard user, I want to know when the dashboard is fetching initial data, so that I understand why the view may be incomplete during the first few seconds.

#### Acceptance Criteria

1. WHEN the Dashboard_UI page mounts and the hydration fetch is in progress, THE Dashboard_UI SHALL display a loading indicator in the header area.
2. WHEN all hydration fetches complete (whether successful or failed), THE Dashboard_UI SHALL remove the loading indicator.
3. WHEN the localStorage_Cache provides pre-populated data, THE Dashboard_UI SHALL still display the loading indicator until the API hydration fetch completes, to signal that fresher data is being retrieved.
