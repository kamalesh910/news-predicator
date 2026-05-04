#!/usr/bin/env bash
# =============================================================================
# start.sh — Start all Sentinel services
# =============================================================================
# Usage:
#   bash start.sh              # start all services (build if needed)
#   bash start.sh --rebuild    # force rebuild all images before starting
#   bash start.sh --fresh      # full clean start (removes volumes first)
# =============================================================================

set -euo pipefail

REBUILD=false
FRESH=false

for arg in "$@"; do
  case "$arg" in
    --rebuild|-r) REBUILD=true ;;
    --fresh|-f)   FRESH=true; REBUILD=true ;;
    --help|-h)
      echo "Usage: bash start.sh [--rebuild] [--fresh]"
      echo ""
      echo "  (no flags)  Start services, reuse existing images and volumes"
      echo "  --rebuild   Force rebuild all Docker images before starting"
      echo "  --fresh     Remove all volumes first, then rebuild and start (clean slate)"
      exit 0
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${CYAN}[start]${NC} $*"; }
success() { echo -e "${GREEN}[start]${NC} $*"; }
warn()    { echo -e "${YELLOW}[start]${NC} $*"; }

echo ""
echo "============================================================"
echo "  Sentinel — Starting all services"
echo "============================================================"
echo ""

# ---------------------------------------------------------------------------
# 1. Optional: clean volumes for a fresh start
# ---------------------------------------------------------------------------
if [ "$FRESH" = true ]; then
  warn "Fresh start requested — removing all volumes..."
  docker compose down --volumes --remove-orphans 2>/dev/null || true
  echo ""
fi

# ---------------------------------------------------------------------------
# 2. Build and start services
# ---------------------------------------------------------------------------
if [ "$REBUILD" = true ]; then
  info "Building images..."
  docker compose build
  echo ""
fi

info "Starting infrastructure and services..."
docker compose up -d

echo ""
info "Waiting for services to become healthy..."

# ---------------------------------------------------------------------------
# 3. Wait for PostgreSQL to be ready
# ---------------------------------------------------------------------------
wait_healthy() {
  local name="$1"
  local max_wait="${2:-120}"
  local elapsed=0

  while [ "$elapsed" -lt "$max_wait" ]; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "missing")
    if [ "$status" = "healthy" ]; then
      success "$name is healthy"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done

  warn "$name did not become healthy within ${max_wait}s (status: $status)"
  return 1
}

wait_healthy "postgres"    60
wait_healthy "kafka"       90
wait_healthy "api-gateway" 120

echo ""

# ---------------------------------------------------------------------------
# 4. Inject 5 seed articles into the raw-news Kafka topic
#    so the pipeline processes them and the dashboard shows live data.
#    (The DB seed in 02_seed.sql handles burst_events/trend_forecasts directly,
#     but we also push raw articles through Kafka so the full pipeline runs.)
# ---------------------------------------------------------------------------
info "Injecting 5 seed articles into the raw-news Kafka topic..."

SEED_ARTICLES=(
  '{"articleId":"seed-00000001","sourceUrl":"https://example.com/energy-policy","title":"Energy Policy Reform Gains Momentum Across South Asia","body":"Governments across South Asia are accelerating energy policy reforms with India and Pakistan announcing joint renewable energy targets. Analysts say the shift could reduce regional carbon emissions by 30 percent over the next decade.","sourceName":"NewsAPI","publishedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'","schemaVersion":"1.0"}'
  '{"articleId":"seed-00000002","sourceUrl":"https://example.com/regional-conflict","title":"Regional Conflict Escalation Raises Diplomatic Concerns","body":"Tensions along the eastern border have escalated following a series of skirmishes prompting emergency diplomatic talks. International observers warn that without immediate de-escalation the situation could destabilise regional trade routes.","sourceName":"SocialStream","publishedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'","schemaVersion":"1.0"}'
  '{"articleId":"seed-00000003","sourceUrl":"https://example.com/tech-layoffs","title":"Tech Sector Layoff Rumors Spark Market Volatility","body":"Unconfirmed reports of large-scale layoffs at several major technology firms have triggered a sell-off in tech stocks. Industry insiders suggest the cuts are part of a broader restructuring driven by AI automation.","sourceName":"NewsAPI","publishedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'","schemaVersion":"1.0"}'
  '{"articleId":"seed-00000004","sourceUrl":"https://example.com/climate-infrastructure","title":"Climate Infrastructure Investment Reaches Record High","body":"Global investment in climate-resilient infrastructure surpassed 2 trillion dollars for the first time according to a new report from the International Energy Agency. Solar and wind projects account for the majority of spending.","sourceName":"NewsAPI","publishedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'","schemaVersion":"1.0"}'
  '{"articleId":"seed-00000005","sourceUrl":"https://example.com/cyber-threat","title":"Cyber Threat Actors Target Critical Infrastructure Networks","body":"Security researchers have identified a coordinated campaign targeting power grid control systems across multiple countries. The attacks exploited zero-day vulnerabilities in industrial control software. Affected nations have raised their cyber alert levels to critical.","sourceName":"SocialStream","publishedAt":"'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'","schemaVersion":"1.0"}'
)

KAFKA_READY=false
for i in 1 2 3 4 5 6; do
  if docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
    KAFKA_READY=true
    break
  fi
  warn "Kafka not ready yet, retrying in 5s... ($i/6)"
  sleep 5
done

if [ "$KAFKA_READY" = true ]; then
  INJECTED=0
  for article in "${SEED_ARTICLES[@]}"; do
    if echo "$article" | docker exec -i kafka \
        kafka-console-producer \
          --bootstrap-server localhost:9092 \
          --topic raw-news \
        > /dev/null 2>&1; then
      INJECTED=$((INJECTED + 1))
    fi
  done
  success "Injected $INJECTED/5 seed articles into raw-news topic"
else
  warn "Kafka not reachable — skipping Kafka seed injection."
  warn "The DB seed data (02_seed.sql) is still loaded via PostgreSQL init."
fi

echo ""

# ---------------------------------------------------------------------------
# 5. Print service URLs
# ---------------------------------------------------------------------------
echo "============================================================"
success "All services started."
echo "============================================================"
echo ""
echo "  Dashboard UI   →  http://localhost:3000"
echo "  API Gateway    →  http://localhost:4000"
echo "  Analysis API   →  http://localhost:8000"
echo "  Prediction API →  http://localhost:8080"
echo ""
echo "  Trending topics REST:  http://localhost:4000/trending-topics"
echo "  Articles REST:         http://localhost:4000/articles"
echo "  Predictions REST:      http://localhost:4000/predictions"
echo ""
echo "  To stop:               bash stop.sh"
echo "  To stop + wipe data:   bash stop.sh --clean"
echo ""
