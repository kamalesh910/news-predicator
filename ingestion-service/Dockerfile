# =============================================================================
# ingestion-service Dockerfile
# Multi-stage build: build stage compiles TypeScript, runtime stage runs dist/
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: build — install all deps and compile TypeScript
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for tsc)
RUN npm ci

# Copy source and TypeScript config
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript → dist/
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime — lean image with only production dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy package manifests and install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from the build stage
COPY --from=build /app/dist ./dist

# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Health endpoint port
EXPOSE 3001

# Start the service
CMD ["node", "dist/index.js"]
