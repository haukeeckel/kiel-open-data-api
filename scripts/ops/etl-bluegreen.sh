#!/bin/sh
set -eu

active_color="$(./scripts/ops/resolve-colors.sh --active)"
inactive_color="$(./scripts/ops/resolve-colors.sh --inactive)"

active_db="data/kiel-${active_color}.duckdb"
inactive_service="api-${inactive_color}"

wait_healthy() {
  service="$1"
  i=0
  while [ "$i" -lt 60 ]; do
    container_id="$(docker compose ps -q "$service")"
    if [ -n "$container_id" ]; then
      status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
      if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
        return 0
      fi
    fi
    i=$((i + 1))
    sleep 2
  done

  echo "etl-bluegreen: $service did not become healthy" >&2
  return 1
}

echo "etl-bluegreen: active=$active_color inactive=$inactive_color"

echo "etl-bluegreen: backup active database ($active_db)"
docker compose run --rm -e DUCKDB_PATH="$active_db" backup

echo "etl-bluegreen: run migrate on inactive color ($inactive_color)"
docker compose run --rm -e TARGET_COLOR="$inactive_color" migrate

echo "etl-bluegreen: run etl on inactive color ($inactive_color)"
docker compose run --rm -e TARGET_COLOR="$inactive_color" etl

echo "etl-bluegreen: start inactive api service ($inactive_service)"
docker compose up -d "$inactive_service"
wait_healthy "$inactive_service"

echo "etl-bluegreen: done (run ./scripts/ops/cutover.sh to switch traffic)"
