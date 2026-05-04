#!/usr/bin/env bash
# =============================================================================
# stop.sh — Stop all Sentinel services
# =============================================================================
# Usage:
#   bash stop.sh           # stop containers, keep volumes (data preserved)
#   bash stop.sh --clean   # stop containers AND remove all volumes (fresh start)
# =============================================================================

set -euo pipefail

CLEAN=false
for arg in "$@"; do
  case "$arg" in
    --clean|-c) CLEAN=true ;;
    --help|-h)
      echo "Usage: bash stop.sh [--clean]"
      echo ""
      echo "  (no flags)  Stop all containers, keep volumes (data preserved)"
      echo "  --clean     Stop all containers AND remove volumes (full reset)"
      exit 0
      ;;
  esac
done

echo ""
echo "============================================================"
echo "  Sentinel — Stopping all services"
echo "============================================================"
echo ""

if [ "$CLEAN" = true ]; then
  echo "Mode: CLEAN (containers + volumes will be removed)"
  echo ""
  docker compose down --volumes --remove-orphans
  echo ""
  echo "All containers and volumes removed."
else
  echo "Mode: SOFT (containers stopped, volumes preserved)"
  echo ""
  docker compose down --remove-orphans
  echo ""
  echo "All containers stopped. Data volumes are preserved."
  echo "Run 'bash stop.sh --clean' to also remove volumes."
fi

echo ""
echo "Done."
echo ""
