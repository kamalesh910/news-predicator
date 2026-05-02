# Implementation Plan: Dashboard Data Persistence

## Overview

Implement two complementary persistence layers for the AI News Dashboard: a localStorage snapshot cache for instant render on mount, and API hydration that fetches the 50 most recent articles and predictions from the API Gateway on page load. Live WebSocket updates continue to merge into state via a shared `mergeUnique` helper. A secondary change updates the `GET /articles` endpoint to LEFT JOIN `bias_records` so hydrated articles carry bias scores.

## Tasks

- [x] 1. Extend API Gateway `getArticles` with bias score join
  - [x] 1.1 Update `Article` interface in `api-gateway/src/articles/articles.service.ts` to add `bias_score: number | null` and `bias_label: string | null` fields
    - Add the two new optional fields to the existing `Article` interface
    - _Requirements: 6.1, 6.2_

  - [x] 1.2 Rewrite the SQL query in `getArticles` to use LEFT JOIN LATERAL on `bias_records`
    - Replace the plain `SELECT … FROM articles` with the lateral join query from the design
    - The subquery selects the single most recent `bias_records` row per article ordered by `analysis_timestamp DESC LIMIT 1`
    - Articles with no bias record must return `bias_score: null` and `bias_label: null`
    - Preserve existing pagination (`LIMIT $1 OFFSET $2`) and ordering (`ORDER BY a.published_at DESC`)
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 1.3 Write unit tests for updated `getArticles` in `api-gateway/src/__tests__/articles.service.test.ts`
    - Mock `DbService.query` to return rows with and without bias record columns
    - Assert that returned objects include `bias_score` and `bias_label`
    - Assert that articles with no bias record have both fields as `null`
    - _Requirements: 6.1, 6.2_

  - [ ]* 1.4 Write property test for `getArticles` pagination contract with bias join
    - **Property 10: getArticles pagination contract is preserved after bias join**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - File: `api-gateway/src/__tests__/articles.service.property.test.ts`
    - For any valid `page` and `pageSize` (1 ≤ pageSize ≤ 100), mock DB returns `pageSize` rows each with `bias_score` and `bias_label`; assert result length ≤ pageSize and every record has both fields present (value may be null)

- [x] 2. Implement `Cache_Manager` in `dashboard-ui/src/lib/cache.ts`
  - [x] 2.1 Create `dashboard-ui/src/lib/cache.ts` with `DashboardCache` interface and constants
    - Define `CACHE_KEY = 'ainews_dashboard_cache'`, `CACHE_TTL_MS = 24 * 60 * 60 * 1000`, and per-type size limits (50 articles, 20 burst events, 50 forecasts)
    - Define the `DashboardCache` interface with `version: 1`, `savedAt: string`, `articles`, `burstEvents`, `forecasts`
    - Import `Article`, `BurstEvent`, `TrendForecast` from `@/types`
    - _Requirements: 3.1, 3.2, 3.3, 3.7_

  - [x] 2.2 Implement `readCache(): DashboardCache | null`
    - Step 1: `localStorage.getItem(CACHE_KEY)` — return `null` if absent
    - Step 2: `JSON.parse` in try/catch — on error call `clearCache()` and return `null`
    - Step 3: Validate `version === 1` and parseable `savedAt` — on failure call `clearCache()` and return `null`
    - Step 4: TTL check — if `Date.now() - new Date(savedAt).getTime() > CACHE_TTL_MS` call `clearCache()` and return `null`
    - Step 5: Return the parsed `DashboardCache`
    - _Requirements: 3.3, 3.5, 3.6_

  - [x] 2.3 Implement `writeCache(data)` and `clearCache()`
    - `writeCache`: slice each input array to its limit, construct `DashboardCache` with `version: 1` and `savedAt: new Date().toISOString()`, call `localStorage.setItem` wrapped in try/catch (silent on `QuotaExceededError`)
    - `clearCache`: call `localStorage.removeItem(CACHE_KEY)`
    - _Requirements: 3.1, 3.2, 3.7_

  - [ ]* 2.4 Write unit tests for `Cache_Manager` in `dashboard-ui/src/__tests__/cache.test.ts`
    - Mock `localStorage` using `jest.spyOn`
    - Test: `readCache` returns `null` when localStorage is empty
    - Test: `readCache` returns `null` for expired `savedAt` (> 24 h ago)
    - Test: `readCache` returns `null` for malformed JSON
    - Test: `readCache` returns `null` when `version !== 1`
    - Test: `writeCache` stores a valid `DashboardCache` with correct structure
    - Test: `writeCache` slices arrays to their respective limits
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7_

  - [ ]* 2.5 Write property tests for `Cache_Manager` in `dashboard-ui/src/__tests__/cache.property.test.ts`
    - **Property 3: Cache write enforces size limits**
    - **Validates: Requirements 3.7**
    - For arbitrary-length article/burstEvent/forecast arrays, after `writeCache` + `JSON.parse(localStorage.getItem(...))` the stored arrays are ≤ their respective limits

    - **Property 4: readCache returns null for malformed entries**
    - **Validates: Requirements 3.5**
    - For any string that is not valid `DashboardCache` JSON, `readCache()` returns `null` and does not throw

    - **Property 5: readCache returns null for expired entries**
    - **Validates: Requirements 3.6**
    - For any otherwise-valid `DashboardCache` with `savedAt` > 24 h in the past, `readCache()` returns `null`

- [x] 3. Checkpoint — cache module complete
  - Ensure all cache tests pass, ask the user if questions arise.

- [x] 4. Implement `Hydration_Client` in `dashboard-ui/src/lib/hydration.ts`
  - [x] 4.1 Create `dashboard-ui/src/lib/hydration.ts` with raw API type definitions and `mapArticle`
    - Define `RawArticle` and `RawPrediction` interfaces matching the snake_case API response shapes (including `bias_score`, `bias_label` on `RawArticle`)
    - Define `HydrationResult` interface
    - Implement `mapArticle(raw: RawArticle): Article` using the mapping table from the design; apply defaults for null/absent fields that match the WebSocket handler defaults in `page.tsx`
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 4.2 Implement `mapBurstEvent` and `mapTrendForecast`
    - `mapBurstEvent(raw: RawPrediction): BurstEvent` — map `id → eventId`, `topic_name → topicName`, `article_count → articleCount`, `window_start → windowStart`, `window_end → windowEnd`, `created_at → detectionTimestamp`; apply defaults matching the WebSocket handler
    - `mapTrendForecast(raw: RawPrediction): TrendForecast` — map `id → forecastId`, `topic_name → topicName`, `predicted_volume → predictedVolume`, `confidence_score → confidenceScore`, `forecast_horizon → forecastHorizon`; apply defaults matching the WebSocket handler
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [x] 4.3 Implement `hydrateAll(signal?: AbortSignal): Promise<HydrationResult>`
    - Fire two `fetch` calls in parallel using `Promise.allSettled`
    - Each call targets `GET /articles?pageSize=50` and `GET /predictions?pageSize=50` using `NEXT_PUBLIC_API_GATEWAY_URL` (default `http://localhost:4000`)
    - Each call uses its own `AbortController` with a 5-second `setTimeout`; clear the timeout if the fetch completes first
    - Non-2xx responses and `AbortError` are caught, logged via `console.error`, and result in an empty array for that data type — never re-thrown
    - Map successful responses through `mapArticle`, `mapBurstEvent`, or `mapTrendForecast` as appropriate
    - Always resolve with `{ articles, burstEvents, forecasts }`
    - _Requirements: 1.1, 1.2, 1.5, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.4 Write unit tests for `Hydration_Client` in `dashboard-ui/src/__tests__/hydration.test.ts`
    - Mock `fetch` using `jest.spyOn(global, 'fetch')`
    - Test: `mapArticle` correctly maps a fully-populated raw article
    - Test: `mapArticle` applies defaults for null/absent fields
    - Test: `mapBurstEvent` correctly maps a fully-populated raw burst event
    - Test: `mapTrendForecast` correctly maps a fully-populated raw trend forecast
    - Test: `hydrateAll` calls both endpoints with `pageSize=50`
    - Test: `hydrateAll` returns empty arrays when fetch returns non-2xx
    - Test: `hydrateAll` returns empty arrays after 5-second timeout (use fake timers)
    - _Requirements: 1.1, 1.2, 1.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_

  - [ ]* 4.5 Write property tests for `Hydration_Client` in `dashboard-ui/src/__tests__/hydration.property.test.ts`
    - **Property 6: mapArticle field mapping is complete and correct**
    - **Validates: Requirements 5.1**
    - For any raw article object with arbitrary string/number/null field values, `mapArticle` produces an `Article` where `articleId === raw.article_id`, `sourceName === raw.source_name`, `publishedAt === raw.published_at`, `biasScore === raw.bias_score`

    - **Property 7: mapBurstEvent field mapping is complete and correct**
    - **Validates: Requirements 5.2, 5.4**
    - For any raw prediction of type `burst_event` with arbitrary field values, all camelCase fields correctly reflect the snake_case source fields; null/absent fields use the same defaults as the WebSocket handler

    - **Property 8: mapTrendForecast field mapping is complete and correct**
    - **Validates: Requirements 5.3, 5.4**
    - For any raw prediction of type `trend_forecast` with arbitrary field values, all camelCase fields correctly reflect the snake_case source fields; null/absent fields use the same defaults as the WebSocket handler

    - **Property 9: hydrateAll returns empty arrays for non-2xx status codes**
    - **Validates: Requirements 4.1, 4.2**
    - For any HTTP status in 400–599, when `hydrateAll` receives that status from either endpoint, the returned `HydrationResult` for that data type is an empty array and no exception is thrown

- [x] 5. Checkpoint — hydration module complete
  - Ensure all hydration tests pass, ask the user if questions arise.

- [x] 6. Add `mergeUnique` helper and wire hydration + cache into `page.tsx`
  - [x] 6.1 Add `mergeUnique` pure helper function to `dashboard-ui/src/app/page.tsx`
    - Signature: `function mergeUnique<T>(existing: T[], incoming: T[], key: keyof T, limit: number): T[]`
    - Prepend items from `incoming` whose `key` value does not appear in `existing`, then slice to `limit`
    - This function must be pure (no side effects)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 6.2 Write property tests for `mergeUnique` in `dashboard-ui/src/__tests__/mergeUnique.property.test.ts`
    - **Property 1: mergeUnique preserves no-duplicate invariant**
    - **Validates: Requirements 2.1, 2.3, 2.4**
    - For any arrays of existing and incoming items sharing the same key type, the result contains no two items with the same key value

    - **Property 2: mergeUnique prepends new items and respects the size limit**
    - **Validates: Requirements 2.2, 2.5**
    - For any existing array, any incoming item whose key does not appear in existing, and any positive limit, the incoming item appears at index 0 of the result and result length never exceeds the limit

  - [x] 6.3 Add `isHydrating` state and cache pre-population on mount in `page.tsx`
    - Add `const [isHydrating, setIsHydrating] = useState(true)` (default `true` so the indicator shows immediately)
    - In a `useEffect` that runs once on mount: call `readCache()` synchronously and pre-populate `articles`, `burstEvents`, `forecasts` state if the cache is non-null
    - _Requirements: 3.3, 3.4, 7.1, 7.3_

  - [x] 6.4 Call `hydrateAll` on mount, merge results, and update cache in `page.tsx`
    - In the same mount `useEffect`: create an `AbortController`, call `hydrateAll(controller.signal)`, await the result
    - On settlement: merge hydration results into state using `mergeUnique` with the correct keys (`articleId`, `eventId`, `forecastId`) and in-memory limits (200 articles, 20 burst events, 50 forecasts)
    - Set `isHydrating = false` after settlement regardless of success or failure
    - Call `writeCache` with the merged state after settlement
    - Return a cleanup function that calls `controller.abort()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 3.1, 7.2_

  - [x] 6.5 Update the WebSocket message handler in `page.tsx` to use `mergeUnique` and add debounced cache writes
    - Replace the inline deduplication logic in the existing `handleMessage` function with calls to `mergeUnique` for all three data types
    - Add a debounced `writeCache` call (≤5 seconds) after each state update from WebSocket messages; use `useRef` to hold the debounce timer
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2_

  - [x] 6.6 Add the loading indicator to the header in `page.tsx`
    - Render `<span className="text-xs text-gray-400 animate-pulse">Refreshing…</span>` inside the header `div` when `isHydrating` is `true`
    - The indicator must be visible even when cache data is already displayed
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 6.7 Write unit tests for `page.tsx` in `dashboard-ui/src/__tests__/page.test.tsx`
    - Use `@testing-library/react`; mock `hydrateAll`, `readCache`, `writeCache`, and `getSocket`
    - Test: loading indicator is shown on mount while fetches are in progress
    - Test: loading indicator is removed after `Promise.allSettled` resolves
    - Test: loading indicator is shown even when cache data is pre-populated
    - Test: no error banner is rendered when hydration fails
    - Test: cache data pre-populates state before fetch resolves
    - _Requirements: 7.1, 7.2, 7.3, 4.5, 4.6, 3.3, 3.4_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Run `jest --runInBand` in both `dashboard-ui/` and `api-gateway/` and confirm all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- `mergeUnique` is defined in `page.tsx` (or a shared util if preferred) and reused by both the hydration merge and the WebSocket handler
- The `fast-check` library (v3.20.0) is already present in both `dashboard-ui` and `api-gateway` devDependencies — no new packages needed
- Property tests use a minimum of 100 iterations each (fast-check default)
- The API Gateway test for Property 10 uses Jest with a mocked `DbService` — no fast-check needed since the DB is mocked and the property is about the query contract, not random data generation
