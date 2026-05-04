# Design Document: Sentinel Risk Intelligence Dashboard UI

## Overview

The Sentinel Risk Intelligence Dashboard is a comprehensive redesign of the existing dashboard-ui Next.js 14 application. It transforms the current light-themed news analytics dashboard into a sophisticated dark-themed risk intelligence platform. The redesign introduces three primary screens (Main Dashboard, Topic Analysis, Geo Intelligence), a modular feature-based architecture, Zustand state management, a centralized Axios API client, Storybook integration, and an SVG-based India map — all while preserving the existing Socket.IO WebSocket connectivity.

### Design Goals

- **Dark-first design system**: All screens share a single token file (ariables.css) so color and typography changes propagate everywhere.
- **Modular feature isolation**: Each screen owns its components, types, and store slice under src/modules/. Shared primitives live in src/components/.
- **Real-time first**: WebSocket events flow directly into Zustand stores; components subscribe reactively with no manual state threading.
- **Zero external map dependency**: The India map is rendered as an inline SVG with city-pin overlays, avoiding Leaflet/Mapbox bundle weight.
- **Testable by design**: Pure transformation functions (store reducers, data mappers, badge classifiers) are extracted so property-based tests can exercise them without DOM rendering.

### Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 App Router | Already in use; App Router enables per-route layouts |
| Styling | Tailwind CSS + CSS custom properties | Tailwind for utility classes; CSS vars for design tokens |
| State | Zustand 4 + persist middleware | Lightweight, no boilerplate, SSR-safe with skipHydration |
| HTTP client | Axios 1.x | Interceptor support for auth/error handling; DI-friendly |
| Charts | Recharts 2 | Already in package.json; composable React components |
| WebSocket | Socket.IO client 4 | Existing singleton in src/lib/websocket.ts — preserved |
| Component dev | Storybook 8 | Isolated story development; Next.js addon for RSC support |
| Testing | Jest + fast-check | Already configured; fast-check for property-based tests |
