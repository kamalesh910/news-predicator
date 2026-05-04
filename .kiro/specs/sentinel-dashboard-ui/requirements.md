# Requirements Document

## Introduction

This document defines the requirements for the **Sentinel Risk Intelligence Dashboard** — a comprehensive UI redesign of the existing `dashboard-ui` Next.js application. The redesign transforms the current light-themed news analytics dashboard into a sophisticated, dark-themed risk intelligence platform with three primary screens: a Main Dashboard, a Topic Analysis view, and a Geo Intelligence view. The project also restructures the codebase into a modular, feature-based architecture with Zustand state management, a centralized Axios API client, Storybook integration, and preserved WebSocket connectivity.

---

## Glossary

- **Dashboard**: The main Sentinel Risk Intelligence screen showing KPI cards, charts, and live trending topics.
- **Topic_Analysis**: The screen providing deep-dive analytics for a single topic, including sentiment velocity, entity salience, semantic clusters, viral narratives, and a signal stream.
- **Geo_Intelligence**: The screen displaying geographic risk data on a map with district-level breakdowns and regional activity timelines.
- **Sidebar**: The fixed left navigation panel present on all screens, containing navigation links and the SENTINEL AI brand header.
- **Header_Bar**: The top horizontal bar present on all screens, containing the logo, global search, notification bell, and user profile.
- **KPI_Card**: A summary metric card displaying a single key performance indicator with a label, value, and optional trend indicator.
- **Sentiment_Velocity_Chart**: A line chart (on the Dashboard) or stacked bar chart (on Topic Analysis) showing sentiment score over time with configurable time-range toggles.
- **Arc_Gauge**: A semicircular gauge component used to display a single score or percentage (e.g., Polarization Index, Critical Risk Level).
- **Signal_Stream**: A chronological timeline of real-time events (narrative shifts, volatility alerts, system updates) displayed on the Topic Analysis screen.
- **ApiClient**: The centralized Axios HTTP client instance located at `src/services/apiClient.ts`.
- **Store**: The Zustand global state store with persist middleware located at `src/store/`.
- **WebSocket_Client**: The existing singleton Socket.IO client in `src/lib/websocket.ts` that must be preserved.
- **ErrorBoundary**: A React error boundary component that catches rendering errors within a module and displays a fallback UI.
- **Storybook**: The isolated component development environment configured at `.storybook/`.
- **Design_Token**: A CSS custom property defined in `src/assets/styles/` that encodes a color, spacing, or typography value from the design system.

---

## Requirements

### Requirement 1: Design System and Global Theming

**User Story:** As a developer, I want a centralized design token system, so that all screens share a consistent dark-themed visual language without duplicating color or typography values.

#### Acceptance Criteria

1. THE Dashboard SHALL use `#11151F` as the base background color, expressed as a CSS custom property `--color-bg-base`.
2. THE Dashboard SHALL use `#2B7FFF` as the primary accent color, expressed as a CSS custom property `--color-accent-primary`.
3. THE Dashboard SHALL use `#E78170` as the alert/danger indicator color, expressed as a CSS custom property `--color-alert`.
4. THE Dashboard SHALL use the Inter font family for all text, loaded via `next/font` or a `@font-face` declaration in the global stylesheet.
5. THE Dashboard SHALL define all Design_Tokens as CSS custom properties in `src/assets/styles/variables.css` and import that file in the Next.js global stylesheet.
6. WHEN a Design_Token value changes in `variables.css`, THE Dashboard SHALL reflect the updated value across all components that reference that token without requiring per-component edits.

---

### Requirement 2: Fixed Left Navigation Sidebar

**User Story:** As an analyst, I want a persistent left sidebar with labeled navigation icons, so that I can switch between dashboard screens at any time without losing my current scroll position.

#### Acceptance Criteria

1. THE Sidebar SHALL be fixed to the left edge of the viewport on all three screens and SHALL NOT scroll with page content.
2. THE Sidebar SHALL display the brand header "SENTINEL AI" at the top.
3. THE Sidebar SHALL render the following navigation items in order: DASHBOARD, LIVE FEED, ALERTS, TOPIC ANALYSIS, GEO INTELLIGENCE, PREDICTIONS, REPORTS, SETTINGS — each with an icon and a text label.
4. WHEN a navigation item corresponds to the currently active screen, THE Sidebar SHALL apply a visually distinct active state (highlighted background using `--color-accent-primary`) to that item.
5. WHEN a user clicks a navigation item, THE Sidebar SHALL navigate to the corresponding screen.
6. THE Sidebar SHALL be accessible: each navigation item SHALL be a focusable element with an `aria-label` and the active item SHALL carry `aria-current="page"`.

---

### Requirement 3: Top Header Bar

**User Story:** As an analyst, I want a persistent top header bar with search and profile access, so that I can search for topics and identify my session context from any screen.

#### Acceptance Criteria

1. THE Header_Bar SHALL be fixed to the top of the content area (to the right of the Sidebar) on all three screens.
2. THE Header_Bar SHALL display the logo text "SENTINEL | RISK INTELLIGENCE".
3. THE Header_Bar SHALL contain a global search input field with placeholder text "Search…".
4. THE Header_Bar SHALL display a notification bell icon.
5. THE Header_Bar SHALL display the user profile label "Analyst Prime | ADMIN PRIVILEGE".
6. WHEN the user types in the global search input, THE Header_Bar SHALL emit the search query value to the application state so that other components can react to it.

---

### Requirement 4: Main Dashboard — KPI Cards Row

**User Story:** As an analyst, I want four KPI cards at the top of the main dashboard, so that I can immediately assess the current state of monitored topics, alerts, regions, and sentiment.

#### Acceptance Criteria

1. THE Dashboard SHALL render four KPI_Cards in a single horizontal row: TOTAL TOPICS, HIGH RISK ALERTS, ACTIVE REGIONS, and GLOBAL SENTIMENT.
2. THE KPI_Card for TOTAL TOPICS SHALL display the value `1,284` and a `+12%` positive trend indicator.
3. THE KPI_Card for HIGH RISK ALERTS SHALL display the value `24 CRITICAL` and SHALL render alert tags for "POLITICAL" and "CYBER".
4. THE KPI_Card for ACTIVE REGIONS SHALL display the value `82 Nodes` with blue avatar indicators.
5. THE KPI_Card for GLOBAL SENTIMENT SHALL display the value `68/100` and the label "STABLE TREND".
6. WHEN the viewport width is below 768px, THE Dashboard SHALL stack the KPI_Cards vertically in a single column.
7. THE KPI_Card component SHALL accept `label`, `value`, `trend`, and `tags` props so that it can be reused across screens with different data.

---

### Requirement 5: Main Dashboard — Sentiment Velocity Chart

**User Story:** As an analyst, I want a sentiment velocity line chart with time-range controls, so that I can observe how sentiment has evolved over the last hour, day, or week.

#### Acceptance Criteria

1. THE Dashboard SHALL render a Sentiment_Velocity_Chart as a line chart in the second row, left panel.
2. THE Sentiment_Velocity_Chart SHALL provide three time-range toggle buttons: `1H`, `24H`, and `7D`.
3. WHEN a time-range toggle is selected, THE Sentiment_Velocity_Chart SHALL update the displayed data to the corresponding time window without a full page reload.
4. THE Sentiment_Velocity_Chart SHALL display a `PEAK: 84.2` annotation marker at the highest data point.
5. THE Sentiment_Velocity_Chart SHALL use `--color-accent-primary` (`#2B7FFF`) as the line stroke color.
6. THE Sentiment_Velocity_Chart SHALL be implemented using the existing `recharts` library already present in `package.json`.

---

### Requirement 6: Main Dashboard — Geo Risk Panel

**User Story:** As an analyst, I want a geo risk panel for India alongside the sentiment chart, so that I can see regional risk distribution at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL render a Geo Risk panel in the second row, right panel, labeled "Geo Risk: India".
2. THE Geo Risk panel SHALL display a dark-themed map of India with location pins.
3. THE Geo Risk panel SHALL display a "Delhi NCR CRITICAL" overlay label.
4. THE Geo Risk panel SHALL display three risk distribution indicators: SAFE 62%, WARNING 24%, DANGER 14%.
5. THE Geo Risk panel SHALL use `--color-alert` (`#E78170`) for DANGER indicators and `--color-accent-primary` (`#2B7FFF`) for SAFE indicators.

---

### Requirement 7: Main Dashboard — Live Trending Topics Table

**User Story:** As an analyst, I want a full-width live trending topics table at the bottom of the main dashboard, so that I can monitor the most active topics across platforms in real time.

#### Acceptance Criteria

1. THE Dashboard SHALL render a full-width Live Trending Topics table in the third row.
2. THE Live Trending Topics table SHALL display the following columns: TOPIC, PLATFORM, SENTIMENT, RISK LEVEL, VOLUME, TREND.
3. THE Live Trending Topics table SHALL display at least the following rows: "Energy Policy Reform", "Regional Conflict Escalation", "Tech Layoff Rumors".
4. THE Live Trending Topics table SHALL display a "VIEW ALL" button that navigates to the LIVE FEED screen.
5. WHEN a new topic arrives via the WebSocket_Client, THE Live Trending Topics table SHALL insert the new row at the top of the table without a full page reload.
6. THE Live Trending Topics table SHALL apply a color-coded RISK LEVEL badge: CRITICAL uses `--color-alert`, ELEVATED uses an amber color, STABLE uses a green color.

---

### Requirement 8: Topic Analysis Screen

**User Story:** As an analyst, I want a dedicated Topic Analysis screen for a selected topic, so that I can examine sentiment trends, key entities, semantic clusters, viral narratives, and influential actors in depth.

#### Acceptance Criteria

1. THE Topic_Analysis screen SHALL display a header containing: a Topic ID tag (e.g., `#TX-9902`), a HIGH VOLATILITY badge, the topic title "Climate Policy Infrastructure", a description, and two action buttons: "Export Analysis" and "Track Narrative".
2. THE Topic_Analysis screen SHALL render a Sentiment_Velocity_Chart as a stacked bar chart in the first row, left panel, with time-range toggles `24H`, `7D`, and `30D`.
3. THE Topic_Analysis screen SHALL render an Entity Salience panel in the first row, right panel, listing ranked keywords with percentage change indicators: Carbon Tax +12.4%, Green Subsidy +8.1%, Net Zero 2050 -2.5%, Grid Modernization +15.9%, Solar Supply Chain +1.2%.
4. THE Topic_Analysis screen SHALL render a Semantic Cluster word cloud in the second row, left panel, displaying terms including: INFRASTRUCTURE, INVESTMENT, HYDROGEN, RENEWABLE, POLICY, EMISSIONS, STRATEGIC, ESG-Scoring.
5. THE Topic_Analysis screen SHALL render a Viral Narratives panel in the second row, center, displaying hashtags: #GreenFuture, #CleanEnergyNow, #NetZero, #GridResilience, #SolarTech, #CarbonZero.
6. THE Topic_Analysis screen SHALL render Key Narrative Driver profile cards in the second row, right panel, for: "Dr. Aris Thorne — Policy Director IRENA, 98.2k IMPACT" and "Elena Vance — Energy Correspondent Reuters, 142.5k REACH".
7. THE Topic_Analysis screen SHALL render a Polarization Index Arc_Gauge in the second row, displaying 72% Constructive Sentiment.
8. THE Topic_Analysis screen SHALL render a Signal_Stream timeline in the third row, displaying events of types: NARRATIVE SHIFT, VOLATILITY ALERT, and SYSTEM UPDATE, each with a timestamp.
9. WHEN a new signal event arrives via the WebSocket_Client, THE Signal_Stream SHALL prepend the new event to the top of the timeline without a full page reload.

---

### Requirement 9: Geo Intelligence Screen

**User Story:** As an analyst, I want a Geo Intelligence screen with an interactive map and district-level risk breakdown, so that I can assess geographic risk distribution and recent regional activity.

#### Acceptance Criteria

1. THE Geo_Intelligence screen SHALL display a header with the title "GEO INTELLIGENCE" and region tabs: South Asia (default selected), Central Asia, and Southeast Asia.
2. THE Geo_Intelligence screen SHALL render a large dark-outlined map of India on the left side of a split layout.
3. THE Geo_Intelligence map SHALL display city pins for: NEW DELHI (labeled CRITICAL), MUMBAI (labeled ELEVATED), and BENGALURU (labeled STABLE).
4. THE Geo_Intelligence map SHALL provide zoom-in and zoom-out controls.
5. WHEN a region tab is selected, THE Geo_Intelligence screen SHALL update the map and analysis panel to reflect the selected region's data.
6. THE Geo_Intelligence screen SHALL render a right-side analysis panel containing: a Critical Risk Level Arc_Gauge displaying score 8.4, a Sentiment KPI_Card displaying -12.4%, and a Stability KPI_Card displaying 64%.
7. THE Geo_Intelligence screen SHALL render a District Breakdown section listing: Central Delhi (CRITICAL, 92% signal density, 14 anomalies), South Delhi (ELEVATED, 74% signal density, 3 anomalies), East Delhi (STABLE, 45% signal density, 1 anomaly).
8. THE Geo_Intelligence screen SHALL render a Regional Activity timeline displaying events of types: protest activity, trading signals, and satellite update, each with a timestamp.
9. WHEN a city pin on the map is clicked, THE Geo_Intelligence screen SHALL highlight the corresponding district in the District Breakdown section.

---

### Requirement 10: Modular Feature-Based Architecture

**User Story:** As a developer, I want the codebase reorganized into a modular feature-based structure, so that each screen's components, services, and types are co-located and independently maintainable.

#### Acceptance Criteria

1. THE Dashboard SHALL organize source files under `src/` into the following top-level directories: `assets/`, `components/common/`, `components/charts/`, `components/elements/`, `modules/dashboard/`, `modules/analysis/`, `modules/geointell/`, `services/`, `store/`, and `types/`.
2. THE Dashboard SHALL place shared components Header and Sidebar in `src/components/common/`.
3. THE Dashboard SHALL place chart wrapper components (VelocityChart, BarChart, ArcGauge) in `src/components/charts/`.
4. THE Dashboard SHALL place atomic UI components (KpiCard, AlertTag, TagCloud) in `src/components/elements/`.
5. THE Dashboard SHALL place all dashboard-screen-specific components in `src/modules/dashboard/components/` and their TypeScript types in `src/modules/dashboard/types.ts`.
6. THE Dashboard SHALL place all topic-analysis-screen-specific components in `src/modules/analysis/components/` and their TypeScript types in `src/modules/analysis/types.ts`.
7. THE Dashboard SHALL place all geo-intelligence-screen-specific components in `src/modules/geointell/components/`.
8. THE Dashboard SHALL preserve the existing `src/lib/websocket.ts` file at its current path without modification to its exported API.
9. THE Dashboard SHALL move existing service logic into the appropriate module `services/` subfolder while preserving the existing function signatures.

---

### Requirement 11: Centralized Axios API Client

**User Story:** As a developer, I want a centralized Axios API client, so that all HTTP requests share a consistent base URL, timeout, and error-handling configuration without duplication.

#### Acceptance Criteria

1. THE ApiClient SHALL be implemented as a configured Axios instance exported from `src/services/apiClient.ts`.
2. THE ApiClient SHALL read the API Gateway base URL from the `NEXT_PUBLIC_API_GATEWAY_URL` environment variable, defaulting to `http://localhost:4000`.
3. THE ApiClient SHALL set a default request timeout of 5000ms.
4. WHEN an HTTP response has a status code of 401, THE ApiClient SHALL redirect the user to the login page.
5. WHEN an HTTP response has a status code of 5xx, THE ApiClient SHALL log the error to the console with the request URL and status code.
6. THE ApiClient SHALL be passed as a parameter to service functions (dependency injection pattern) rather than imported directly inside service implementations.
7. THE Dashboard SHALL replace all existing `fetch` calls in `src/lib/hydration.ts` with calls through the ApiClient when the hydration service is migrated to its module folder.

---

### Requirement 12: Zustand State Management

**User Story:** As a developer, I want Zustand stores with persist middleware, so that application state survives page refreshes and is accessible across components without prop drilling.

#### Acceptance Criteria

1. THE Store SHALL be implemented using Zustand with the `persist` middleware from `zustand/middleware`.
2. THE Store SHALL define a global store slice in `src/store/` containing: WebSocket connection status, global search query, and notification count.
3. THE Store SHALL define a dashboard module store slice containing: articles list, burst events list, trend forecasts list, and selected region.
4. THE Store SHALL define an analysis module store slice containing: active topic ID, active time range, and entity salience data.
5. THE Store SHALL define a geo-intelligence module store slice containing: active region tab, selected city pin, and district breakdown data.
6. WHEN the application is reloaded, THE Store SHALL rehydrate persisted slices from `localStorage` using the Zustand `persist` middleware.
7. THE Store SHALL replace the existing manual `localStorage` read/write logic in `src/lib/cache.ts` and `src/app/page.tsx` with Zustand store subscriptions.

---

### Requirement 13: Error Boundaries

**User Story:** As an analyst, I want error boundaries wrapping each major module view, so that a rendering error in one screen does not crash the entire application.

#### Acceptance Criteria

1. THE Dashboard SHALL implement an ErrorBoundary React class component in `src/components/common/ErrorBoundary.tsx`.
2. THE ErrorBoundary SHALL accept a `fallback` prop of type `React.ReactNode` to render when an error is caught.
3. WHEN a rendering error occurs inside a wrapped module, THE ErrorBoundary SHALL display the `fallback` UI instead of the broken component tree.
4. WHEN a rendering error occurs, THE ErrorBoundary SHALL log the error and component stack to the console.
5. THE Dashboard module view, THE Topic_Analysis module view, and THE Geo_Intelligence module view SHALL each be individually wrapped in an ErrorBoundary instance.

---

### Requirement 14: Storybook Integration

**User Story:** As a developer, I want Storybook configured for the project, so that chart and complex UI components can be developed and reviewed in isolation without running the full application.

#### Acceptance Criteria

1. THE Dashboard SHALL include a `.storybook/` directory at the root of `dashboard-ui/` with `main.ts` and `preview.ts` configuration files.
2. THE Storybook configuration SHALL support Next.js and TypeScript.
3. THE Dashboard SHALL provide Storybook stories for the following components: KpiCard, AlertTag, ArcGauge, VelocityChart, and TagCloud.
4. WHEN `npm run storybook` is executed in the `dashboard-ui/` directory, THE Storybook server SHALL start without errors.
5. WHERE a component story is defined, THE Storybook SHALL render the component with the provided args in isolation without requiring a live API connection.

---

### Requirement 15: WebSocket Integration Preservation

**User Story:** As a developer, I want the existing WebSocket connection logic preserved and integrated into the new architecture, so that real-time data continues to flow into the redesigned UI without regression.

#### Acceptance Criteria

1. THE WebSocket_Client at `src/lib/websocket.ts` SHALL retain its existing exported functions: `getSocket`, `getConnectionStatus`, `onStatusChange`, and `resetSocket`.
2. THE Dashboard module SHALL subscribe to WebSocket messages of type `article`, `burst_event`, and `trend_forecast` and update the Zustand dashboard store accordingly.
3. THE Topic_Analysis module SHALL subscribe to WebSocket messages of type `signal_event` and update the Signal_Stream in the Zustand analysis store.
4. WHEN the WebSocket connection status changes, THE Header_Bar SHALL reflect the updated status (connected/reconnecting/disconnected) using the existing `onStatusChange` subscription.
5. THE Dashboard SHALL preserve the existing debounced cache-write behavior (5-second debounce) when persisting real-time data, implemented via the Zustand store's persist middleware subscription.

---

### Requirement 16: Accessibility

**User Story:** As an analyst using assistive technology, I want the dashboard to meet WCAG 2.1 AA standards, so that all screens are navigable and understandable without relying solely on color.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a color contrast ratio of at least 4.5:1 between text and background for all body text, measured against the `--color-bg-base` background.
2. THE Sidebar navigation items SHALL be keyboard-navigable using Tab and Enter keys.
3. THE KPI_Card, Arc_Gauge, and chart components SHALL include `aria-label` attributes describing their content for screen readers.
4. THE Dashboard SHALL not convey risk level information through color alone; each risk level SHALL also include a text label (CRITICAL, ELEVATED, STABLE).
5. WHEN a modal or overlay is opened, THE Dashboard SHALL trap keyboard focus within the overlay and restore focus to the trigger element when the overlay is closed.
