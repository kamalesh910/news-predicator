# =============================================================================
# dashboard-ui — Next.js 14 multi-stage Dockerfile
# Stage 1 (deps):    install production dependencies
# Stage 2 (build):   install all deps, copy source, run next build (standalone)
# Stage 3 (runtime): minimal image with standalone output, non-root user
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: deps — install production dependencies only
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: build — install all deps, copy source, compile
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Copy application source (public/ dir is included here)
COPY . .

# Build Next.js with standalone output
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runtime — minimal image with standalone output
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy standalone server bundle produced by next build
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public directory (always present — created as empty dir if nothing in it)
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
