#!/usr/bin/env bash
# =============================================================================
# start.sh — Single command to start the AI News Reader and Predictor stack
#
# Usage:
#   bash start.sh           # start everything (build if needed)
#   bash start.sh --build   # force rebuild all images
#   bash start.sh --stop    # stop all containers
#   bash start.sh --clean   # stop and remove all containers + volumes (wipes data)
#   bash start.sh --status  # show container health status
#   bash start.sh --logs    # tail logs from all services
#   bash start.sh --logs ingestion-service   # tail logs from one service
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}$*${NC}"; }

# ---------------------------------------------------------------------------
# Health check endpoints
# ---------------------------------------------------------------------------
declare -A HEALTH_URLS=(
  ["ingestion-service"]="http://localhost:3001/health"
  ["analysis-service"]="http://localhost:8000/health"
  ["prediction-service"]="http://localhost:8080/health"
  ["api-gateway"]="http://localhost:4000/health"
  ["dashboard-ui"]="http://localhost:3000"
)

DASHBOARD_URL="http://localhost:3000"
HEALTH_TIMEOUT=180   # seconds to wait for each service
POLL_INTERVAL=3

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
ACTION="start"
BUILD_FLAG=""
SERVICE_FILTER=""

for arg in "$@"; do
  case "$arg" in
    --build)  BUILD_FLAG="--build" ;;
    --stop)   ACTION="stop" ;;
    --clean)  ACTION="clean" ;;
    --status) ACTION="status" ;;
    --logs)   ACTION="logs" ;;
    --help|-h) ACTION="help" ;;
    *)
      # Treat unknown args after --logs as a service name
      if [[ "$ACTION" == "logs" ]]; then
        SERVICE_FILTER="$arg"
      fi
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
show_help() {
  echo ""
  echo -e "${BOLD}AI News Reader and Predictor — Start Script${NC}"
  echo ""
  echo "Usage:"
  echo "  bash start.sh                  Start the full stack (uses cached images)"
  echo "  bash start.sh --build          Force rebuild all Docker images then start"
  echo "  bash start.sh --stop           Stop all running containers"
  echo "  bash start.sh --clean          Stop containers and delete all data volumes"
  echo "  bash start.sh --status         Show health status of all services"
  echo "  bash start.sh --logs           Tail logs from all services"
  echo "  bash start.sh --logs <name>    Tail logs from one service"
  echo "  bash start.sh --help           Show this help"
  echo ""
  echo "Service names: ingestion-service, analysis-service, prediction-service,"
  echo "               api-gateway, dashboard-ui, kafka, postgres, redis"
  echo ""
}

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
check_prerequisites() {
  header "Checking prerequisites..."

  local missing=0

  if ! command -v docker &>/dev/null; then
    error "Docker is not installed. Install from https://docs.docker.com/get-docker/"
    missing=1
  else
    local docker_version
    docker_version=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)
    success "Docker found (${docker_version})"
  fi

  if ! docker info &>/dev/null; then
    error "Docker daemon is not running. Start Docker Desktop or the Docker service."
    missing=1
  else
    success "Docker daemon is running"
  fi

  if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
    error "Docker Compose is not installed."
    missing=1
  else
    success "Docker Compose found"
  fi

  if [[ "$missing" -eq 1 ]]; then
    echo ""
    error "Please install the missing prerequisites and try again."
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Detect docker compose command (v1 vs v2)
# ---------------------------------------------------------------------------
compose_cmd() {
  if docker compose version &>/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

# ---------------------------------------------------------------------------
# Setup .env file
# ---------------------------------------------------------------------------
setup_env() {
  if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
      warn ".env file not found — copying from .env.example"
      cp .env.example .env
      warn "Review .env and update POSTGRES_PASSWORD before production use."
    else
      warn ".env.example not found — Docker Compose will use built-in defaults."
    fi
  else
    success ".env file found"
  fi
}

# ---------------------------------------------------------------------------
# Wait for a single health endpoint
# ---------------------------------------------------------------------------
wait_for_service() {
  local name="$1"
  local url="$2"
  local elapsed=0

  printf "  %-22s " "${name}..."

  while true; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "${url}" 2>/dev/null || echo "000")

    if [[ "$code" == "200" ]]; then
      echo -e "${GREEN}healthy${NC}"
      return 0
    fi

    if [[ "$elapsed" -ge "$HEALTH_TIMEOUT" ]]; then
      echo -e "${RED}timed out (${HEALTH_TIMEOUT}s)${NC}"
      return 1
    fi

    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
    printf "."
  done
}

# ---------------------------------------------------------------------------
# Wait for all services
# ---------------------------------------------------------------------------
wait_for_all_services() {
  header "Waiting for services to become healthy..."
  echo "  (analysis-service may take 60–90s while the BERT model loads)"
  echo ""

  local failed=0

  for name in ingestion-service analysis-service prediction-service api-gateway dashboard-ui; do
    wait_for_service "$name" "${HEALTH_URLS[$name]}" || failed=1
  done

  echo ""

  if [[ "$failed" -eq 1 ]]; then
    error "One or more services failed to become healthy."
    echo ""
    echo "  Check logs with:  bash start.sh --logs"
    echo "  Or for one service: bash start.sh --logs analysis-service"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Print service URLs after successful startup
# ---------------------------------------------------------------------------
print_urls() {
  header "All services are running!"
  echo ""
  echo -e "  ${BOLD}Dashboard UI${NC}         ${GREEN}http://localhost:3000${NC}"
  echo -e "  ${BOLD}API Gateway${NC}          http://localhost:4000"
  echo -e "  ${BOLD}API Gateway Health${NC}   http://localhost:4000/health"
  echo -e "  ${BOLD}Ingestion Health${NC}     http://localhost:3001/health"
  echo -e "  ${BOLD}Analysis Health${NC}      http://localhost:8000/health"
  echo -e "  ${BOLD}Prediction Health${NC}    http://localhost:8080/health"
  echo ""
  echo -e "  ${BOLD}PostgreSQL${NC}           localhost:5432  (db: ainews)"
  echo -e "  ${BOLD}Redis${NC}                localhost:6379"
  echo -e "  ${BOLD}Kafka${NC}                localhost:29092"
  echo ""
  echo "  To stop:          bash start.sh --stop"
  echo "  To view logs:     bash start.sh --logs"
  echo "  To run E2E tests: bash e2e/validate-pipeline.sh"
  echo ""
}

# ---------------------------------------------------------------------------
# Show current container status
# ---------------------------------------------------------------------------
show_status() {
  header "Container status"
  echo ""
  compose_cmd ps
  echo ""

  header "Health check"
  echo ""
  for name in ingestion-service analysis-service prediction-service api-gateway dashboard-ui; do
    local url="${HEALTH_URLS[$name]}"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "${url}" 2>/dev/null || echo "000")
    if [[ "$code" == "200" ]]; then
      printf "  %-22s ${GREEN}healthy${NC} (HTTP 200)\n" "${name}"
    else
      printf "  %-22s ${RED}unreachable${NC} (HTTP %s)\n" "${name}" "${code}"
    fi
  done
  echo ""
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------
case "$ACTION" in

  help)
    show_help
    exit 0
    ;;

  stop)
    header "Stopping all containers..."
    compose_cmd stop
    success "All containers stopped. Data volumes are preserved."
    echo "  To start again: bash start.sh"
    echo "  To wipe data:   bash start.sh --clean"
    echo ""
    exit 0
    ;;

  clean)
    header "Stopping containers and removing all data volumes..."
    echo ""
    warn "This will permanently delete all PostgreSQL data, Kafka data, and Redis data."
    read -r -p "  Are you sure? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
      info "Aborted."
      exit 0
    fi
    compose_cmd down -v
    success "All containers and volumes removed."
    echo ""
    exit 0
    ;;

  status)
    show_status
    exit 0
    ;;

  logs)
    if [[ -n "$SERVICE_FILTER" ]]; then
      compose_cmd logs -f "$SERVICE_FILTER"
    else
      compose_cmd logs -f
    fi
    exit 0
    ;;

  start)
    echo ""
    echo -e "${BOLD}============================================${NC}"
    echo -e "${BOLD}  AI News Reader and Predictor${NC}"
    echo -e "${BOLD}============================================${NC}"
    echo ""

    check_prerequisites
    setup_env

    header "Starting all services..."
    echo ""

    # Pull latest base images quietly, then build and start
    compose_cmd up -d ${BUILD_FLAG}

    echo ""
    wait_for_all_services
    print_urls
    ;;

esac
