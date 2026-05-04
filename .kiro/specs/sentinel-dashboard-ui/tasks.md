# Implementation Plan: Sentinel Risk Intelligence Dashboard UI

## Overview

Incrementally transform the existing `dashboard-ui` Next.js 14 application into the Sentinel Risk Intelligence platform. The plan follows a bottom-up order: design tokens → shared infrastructure (Zustand, Axios, ErrorBoundary) → shared UI primitives → module screens → Storybook stories → final wiring and cleanup.

The implementation language is **TypeScript** with **Next.js 14 App Router**, **Tailwind CSS**, **Zustand 4**, **Axios 1.x**, **Recharts 2**, and **Socket.IO client 4**.

## Tasks

- [x] 1. Set up design tokens and global stylesheet
  - Create `src/assets/styles/variables.css` defining all CSS custom properties: `--color-bg-base: #11151F`, `--color-accent-primary: #2B7FFF`, `--color-alert: #E78170`, and supporting surface/text/border tokens
  - Import `variables.css` in `src/app/globals.css` before the Tailwind directives
  - Update `tailwind.config.ts` to extend the theme with `content` paths covering `src/modules/**` and `src/components/**`
  - Load the Inter font via `next/font/google` in `src/app/layout.tsx` and apply it to the `<body>` class
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Install new dependencies and configure module path aliases
  - Install `zustand@^4`, `axios@^1`, `@storybook/nextjs@^8`, `@storybook/addon-essentials`, `@storybook/react` as dev dependencies
  - Add `"@/*": ["./src/*"]` path alias to `tsconfig.json` if not already present; extend to cover `src/modules` and `src/components`
  - _Requirements: 10.1, 11.1, 12.1, 14.1_

- [x] 3. Create modular directory structure and migrate existing types
  - Create the following empty index files to establish the directory tree: `src/assets/styles/`, `src/components/common/`, `src/components/charts/`, `src/components/elements/`, `src/modules/dashboard/components/`, `src/modules/dashboard/types.ts`, `src/modules/analysis/components/`, `src/modules/analysis/types.ts`, `src/modules/geointell/components/`, `src/services/`, `src/store/`
  - Move `src/types/index.ts` content into `src/modules/dashboard/types.ts` (Article, BurstEvent, TrendForecast) and re-export from `src/types/index.ts` for backward compatibility
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 4. Implement the centralized Axios API client
  - Create `src/services/apiClient.ts` exporting a configured Axios instance with `baseURL` from `NEXT_PUBLIC_API_GATEWAY_URL` (default `http://localhost:4000`), `timeout: 5000`
  - Add a response interceptor: on 401 redirect to `/login`; on 5xx log `[apiClient] ${status} ${config.url}` to console
  - Export a factory function `createApiClient(baseURL?: string)` for dependency injection in service functions
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 5. Migrate hydration service to module folder and replace fetch with Axios
  - Copy `src/lib/hydration.ts` to `src/services/hydrationService.ts`; replace all `fetch` calls with the injected `apiClient` Axios instance
  - Keep `mapArticle`, `mapBurstEvent`, `mapTrendForecast` as pure exported functions (they are used by tests)
  - Update imports in `src/app/page.tsx` to point to the new service path
  - _Requirements: 10.9, 11.7_

- [x] 6. Implement Zustand global store and module slices
  - Create `src/store/globalStore.ts` with a Zustand slice (with `persist` middleware, `localStorage` storage key `sentinel-global`) containing: `wsStatus: ConnectionStatus`, `searchQuery: string`, `notificationCount: number`, and their setters
  - Create `src/store/dashboardStore.ts` with a Zustand slice (persist key `sentinel-dashboard`) containing: `articles: Article[]`, `burstEvents: BurstEvent[]`, `forecasts: TrendForecast[]`, `selectedRegion: string | null`, and actions `setArticles`, `setBurstEvents`, `setForecasts`, `setSelectedRegion`, `mergeArticle`, `mergeBurstEvent`, `mergeForecast`
  - Create `src/store/analysisStore.ts` with a Zustand slice (persist key `sentinel-analysis`) containing: `activeTopicId: string | null`, `activeTimeRange: '24H' | '7D' | '30D'`, `entitySalience: EntitySalienceItem[]`, and their setters
  - Create `src/store/geoStore.ts` with a Zustand slice (persist key `sentinel-geo`) containing: `activeRegionTab: string`, `selectedCityPin: string | null`, `districtBreakdown: DistrictItem[]`, and their setters
  - All slices use `skipHydration: true` in persist options for SSR safety
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 7. Replace legacy cache and page state with Zustand store
  - Update `src/app/page.tsx` to read initial state from `useDashboardStore` instead of `readCache`/`writeCache`
  - Implement a Zustand `persist` middleware `onRehydrateStorage` callback that replaces the manual `localStorage` read in the old `useEffect`
  - Implement the 5-second debounced cache-write behavior via a `subscribe` listener on the dashboard store that calls `writeCache` (keep `src/lib/cache.ts` as the write adapter until full migration is complete)
  - _Requirements: 12.7, 15.5_

- [x] 8. Implement ErrorBoundary component
  - Create `src/components/common/ErrorBoundary.tsx` as a React class component with `componentDidCatch` logging `error` and `errorInfo.componentStack` to console
  - Accept a `fallback: React.ReactNode` prop; render it when `state.hasError` is true
  - Export `ErrorBoundary` as the default export
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 9. Implement shared atomic UI components
  - [x] 9.1 Create `src/components/elements/KpiCard.tsx`
    - Props: `label: string`, `value: string`, `trend?: string`, `tags?: string[]`, `ariaLabel?: string`
    - Render label, value, optional trend indicator (green for positive, red for negative prefix), optional tag pills
    - Include `aria-label` attribute on the root element
    - _Requirements: 4.7, 16.3_

  - [ ]* 9.2 Write unit tests for KpiCard
    - Test renders label and value; test positive/negative trend styling; test tags render; test aria-label
    - _Requirements: 4.7, 16.3_

  - [x] 9.3 Create `src/components/elements/AlertTag.tsx`
    - Props: `label: string`, `variant: 'critical' | 'elevated' | 'stable'`
    - Apply `--color-alert` for critical, amber for elevated, green for stable
    - Always render the text label alongside color (not color-only)
    - _Requirements: 7.6, 16.4_

  - [x] 9.4 Create `src/components/elements/TagCloud.tsx`
    - Props: `tags: string[]`
    - Render each tag as a styled pill; no external dependency
    - _Requirements: 8.4_

- [ ] 10. Implement shared chart components
  - [x] 10.1 Create `src/components/charts/VelocityChart.tsx`
    - Props: `data: { time: string; value: number }[]`, `timeRanges: string[]`, `activeRange: string`, `onRangeChange: (range: string) => void`, `peakAnnotation?: string`, `chartType: 'line' | 'bar'`
    - Render a Recharts `LineChart` when `chartType === 'line'` and a `BarChart` when `chartType === 'bar'`
    - Render time-range toggle buttons; apply `--color-accent-primary` as line/bar stroke
    - Include `aria-label` on the chart wrapper
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.2, 16.3_

  - [ ]* 10.2 Write unit tests for VelocityChart
    - Test time-range toggle calls `onRangeChange`; test `peakAnnotation` renders when provided
    - _Requirements: 5.3, 5.4_

  - [x] 10.3 Create `src/components/charts/ArcGauge.tsx`
    - Props: `value: number`, `max: number`, `label: string`, `ariaLabel: string`
    - Render a semicircular SVG arc gauge; display numeric value and label text
    - Include `aria-label` attribute
    - _Requirements: 8.7, 9.6, 16.3_

  - [ ]* 10.4 Write unit tests for ArcGauge
    - Test renders value and label; test aria-label is applied
    - _Requirements: 8.7, 16.3_

- [ ] 11. Implement Sidebar and Header Bar shared components
  - [x] 11.1 Create `src/components/common/Sidebar.tsx`
    - Fixed left navigation with brand header "SENTINEL AI"
    - Navigation items in order: DASHBOARD, LIVE FEED, ALERTS, TOPIC ANALYSIS, GEO INTELLIGENCE, PREDICTIONS, REPORTS, SETTINGS — each with an icon (use inline SVG or a simple icon set) and text label
    - Accept `activePath: string` prop; apply `--color-accent-primary` background to the matching item
    - Each item is an `<a>` or Next.js `<Link>` with `aria-label` and `aria-current="page"` on the active item
    - Keyboard-navigable via Tab and Enter
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 16.2_

  - [x] 11.2 Create `src/components/common/HeaderBar.tsx`
    - Fixed top bar with logo text "SENTINEL | RISK INTELLIGENCE"
    - Global search `<input>` with placeholder "Search…"; on change dispatch `setSearchQuery` to global store
    - Notification bell icon
    - User profile label "Analyst Prime | ADMIN PRIVILEGE"
    - Subscribe to `wsStatus` from global store and render a colored dot: green for connected, amber for reconnecting, red for disconnected
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 15.4_

  - [ ]* 11.3 Write unit tests for HeaderBar
    - Test search input dispatches to store; test connection status dot renders correct color for each status
    - _Requirements: 3.6, 15.4_

- [ ] 12. Implement Main Dashboard screen
  - [x] 12.1 Create `src/modules/dashboard/components/KpiRow.tsx`
    - Render four `KpiCard` instances: TOTAL TOPICS (1,284, +12%), HIGH RISK ALERTS (24 CRITICAL, tags: POLITICAL, CYBER), ACTIVE REGIONS (82 Nodes), GLOBAL SENTIMENT (68/100, STABLE TREND)
    - Use CSS grid with `grid-cols-4`; collapse to `grid-cols-1` below 768px via Tailwind `sm:` prefix
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 12.2 Create `src/modules/dashboard/components/GeoRiskPanel.tsx`
    - Render a dark-themed inline SVG outline of India with three location pins
    - Display "Delhi NCR CRITICAL" overlay label
    - Display risk distribution: SAFE 62% (accent-primary color), WARNING 24% (amber), DANGER 14% (alert color)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 12.3 Create `src/modules/dashboard/components/TrendingTopicsTable.tsx`
    - Columns: TOPIC, PLATFORM, SENTIMENT, RISK LEVEL, VOLUME, TREND
    - Seed rows: "Energy Policy Reform", "Regional Conflict Escalation", "Tech Layoff Rumors"
    - Subscribe to `articles` from dashboard store; prepend new rows on WebSocket updates without full reload
    - Render `AlertTag` for RISK LEVEL column; render "VIEW ALL" button that navigates to `/live-feed`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 12.4 Create `src/modules/dashboard/DashboardView.tsx`
    - Compose `KpiRow`, `VelocityChart` (line, ranges 1H/24H/7D), `GeoRiskPanel`, and `TrendingTopicsTable`
    - Subscribe to WebSocket `article`, `burst_event`, `trend_forecast` messages via `getSocket()` and dispatch to dashboard store
    - Wrap the entire view in `<ErrorBoundary fallback={<p>Dashboard unavailable</p>}>`
    - _Requirements: 4.1, 5.1, 6.1, 7.1, 13.5, 15.2_

- [x] 13. Checkpoint — Main Dashboard
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement Topic Analysis screen
  - [x] 14.1 Create `src/modules/analysis/components/TopicHeader.tsx`
    - Display topic ID tag `#TX-9902`, HIGH VOLATILITY badge, title "Climate Policy Infrastructure", description text, and two buttons: "Export Analysis" and "Track Narrative"
    - _Requirements: 8.1_

  - [x] 14.2 Create `src/modules/analysis/components/EntitySaliencePanel.tsx`
    - Render ranked keyword list with percentage change indicators: Carbon Tax +12.4%, Green Subsidy +8.1%, Net Zero 2050 -2.5%, Grid Modernization +15.9%, Solar Supply Chain +1.2%
    - Positive changes in accent-primary color, negative in alert color
    - _Requirements: 8.3_

  - [x] 14.3 Create `src/modules/analysis/components/SemanticCluster.tsx`
    - Render a word cloud using `TagCloud` component with terms: INFRASTRUCTURE, INVESTMENT, HYDROGEN, RENEWABLE, POLICY, EMISSIONS, STRATEGIC, ESG-Scoring
    - _Requirements: 8.4_

  - [x] 14.4 Create `src/modules/analysis/components/ViralNarratives.tsx`
    - Render hashtag pills: #GreenFuture, #CleanEnergyNow, #NetZero, #GridResilience, #SolarTech, #CarbonZero
    - _Requirements: 8.5_

  - [x] 14.5 Create `src/modules/analysis/components/NarrativeDriverCards.tsx`
    - Render two profile cards: "Dr. Aris Thorne — Policy Director IRENA, 98.2k IMPACT" and "Elena Vance — Energy Correspondent Reuters, 142.5k REACH"
    - _Requirements: 8.6_

  - [x] 14.6 Create `src/modules/analysis/components/SignalStream.tsx`
    - Render a chronological timeline of signal events with types: NARRATIVE SHIFT, VOLATILITY ALERT, SYSTEM UPDATE — each with a timestamp
    - Subscribe to WebSocket `signal_event` messages via `getSocket()` and prepend new events to the analysis store's signal list
    - _Requirements: 8.8, 8.9, 15.3_

  - [x] 14.7 Create `src/modules/analysis/AnalysisView.tsx`
    - Compose `TopicHeader`, `VelocityChart` (bar, ranges 24H/7D/30D), `EntitySaliencePanel`, `SemanticCluster`, `ViralNarratives`, `NarrativeDriverCards`, `ArcGauge` (72%, "Constructive Sentiment"), and `SignalStream`
    - Wrap the entire view in `<ErrorBoundary fallback={<p>Topic Analysis unavailable</p>}>`
    - _Requirements: 8.1, 8.2, 8.7, 13.5_

- [ ] 15. Implement Geo Intelligence screen
  - [x] 15.1 Create `src/modules/geointell/components/IndiaMap.tsx`
    - Render a large dark-outlined inline SVG map of India
    - Overlay city pins for NEW DELHI (CRITICAL), MUMBAI (ELEVATED), BENGALURU (STABLE) with `AlertTag` color coding
    - Render zoom-in / zoom-out controls that scale the SVG viewBox
    - On city pin click, dispatch `setSelectedCityPin` to geo store
    - _Requirements: 9.2, 9.3, 9.4, 9.9_

  - [x] 15.2 Create `src/modules/geointell/components/RegionTabs.tsx`
    - Render tabs: South Asia (default), Central Asia, Southeast Asia
    - On tab click, dispatch `setActiveRegionTab` to geo store and update map/analysis panel
    - _Requirements: 9.1, 9.5_

  - [x] 15.3 Create `src/modules/geointell/components/DistrictBreakdown.tsx`
    - Render district list: Central Delhi (CRITICAL, 92%, 14 anomalies), South Delhi (ELEVATED, 74%, 3 anomalies), East Delhi (STABLE, 45%, 1 anomaly)
    - Highlight the district matching `selectedCityPin` from geo store
    - _Requirements: 9.7, 9.9_

  - [x] 15.4 Create `src/modules/geointell/components/RegionalActivityTimeline.tsx`
    - Render timeline events: protest activity, trading signals, satellite update — each with a timestamp
    - _Requirements: 9.8_

  - [x] 15.5 Create `src/modules/geointell/GeoIntelligenceView.tsx`
    - Compose `RegionTabs`, `IndiaMap`, `ArcGauge` (8.4 / 10, "Critical Risk Level"), `KpiCard` (Sentiment -12.4%), `KpiCard` (Stability 64%), `DistrictBreakdown`, and `RegionalActivityTimeline` in a split layout
    - Wrap the entire view in `<ErrorBoundary fallback={<p>Geo Intelligence unavailable</p>}>`
    - _Requirements: 9.1, 9.6, 9.7, 9.8, 13.5_

- [x] 16. Checkpoint — Topic Analysis and Geo Intelligence
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Create Next.js App Router pages and shared layout
  - Update `src/app/layout.tsx` to render `<Sidebar>` and `<HeaderBar>` as persistent chrome; wrap `{children}` in a `<main>` with left padding to account for the fixed sidebar
  - Create `src/app/page.tsx` (Main Dashboard) — render `<DashboardView />`
  - Create `src/app/analysis/page.tsx` — render `<AnalysisView />`
  - Create `src/app/geo/page.tsx` — render `<GeoIntelligenceView />`
  - Wire Sidebar navigation links to `/`, `/analysis`, `/geo`, `/live-feed`, `/alerts`, `/predictions`, `/reports`, `/settings`
  - Initialize WebSocket connection status subscription in layout: call `onStatusChange` and dispatch to global store's `setWsStatus`
  - _Requirements: 2.5, 3.1, 10.1, 15.1, 15.4_

- [x] 18. Configure Storybook
  - Create `.storybook/main.ts` with `@storybook/nextjs` framework, TypeScript support, and `stories: ['../src/**/*.stories.@(ts|tsx)']`
  - Create `.storybook/preview.ts` importing `src/assets/styles/variables.css` and `src/app/globals.css` so design tokens are available in stories
  - Add `"storybook": "storybook dev -p 6006"` and `"build-storybook": "storybook build"` scripts to `package.json`
  - _Requirements: 14.1, 14.2, 14.4_

- [ ] 19. Write Storybook stories for shared components
  - [x] 19.1 Create `src/components/elements/KpiCard.stories.tsx`
    - Stories: Default, WithTrend, WithTags, CriticalAlert
    - _Requirements: 14.3, 14.5_

  - [x] 19.2 Create `src/components/elements/AlertTag.stories.tsx`
    - Stories: Critical, Elevated, Stable
    - _Requirements: 14.3, 14.5_

  - [x] 19.3 Create `src/components/charts/ArcGauge.stories.tsx`
    - Stories: LowValue, MidValue, HighValue
    - _Requirements: 14.3, 14.5_

  - [x] 19.4 Create `src/components/charts/VelocityChart.stories.tsx`
    - Stories: LineChart, BarChart, WithPeakAnnotation
    - _Requirements: 14.3, 14.5_

  - [x] 19.5 Create `src/components/elements/TagCloud.stories.tsx`
    - Stories: Default, ManyTags
    - _Requirements: 14.3, 14.5_

- [x] 20. Accessibility pass
  - Audit all interactive elements for keyboard navigability (Tab, Enter); fix any missing `tabIndex` or `onKeyDown` handlers
  - Verify all `KpiCard`, `ArcGauge`, and chart components have descriptive `aria-label` attributes
  - Verify risk level badges always include text labels (CRITICAL, ELEVATED, STABLE) alongside color
  - Verify color contrast of body text against `--color-bg-base` meets 4.5:1 ratio; adjust token values if needed
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 21. Final checkpoint — Ensure all tests pass
  - Run `npm test` in `dashboard-ui/`; ensure all existing and new tests pass
  - Verify `npm run build` completes without TypeScript errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- The design document's technology stack (TypeScript, Next.js 14, Tailwind, Zustand, Axios, Recharts) drives all implementation choices
- `src/lib/websocket.ts` must not be modified — all WebSocket integration goes through its existing exported API
- The India SVG map is rendered inline to avoid adding Leaflet/Mapbox as dependencies
- Storybook stories must not require a live API or WebSocket connection to render
