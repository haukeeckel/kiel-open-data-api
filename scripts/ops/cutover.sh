#!/bin/sh
set -eu

target_color="${1:-$(./scripts/ops/resolve-colors.sh --inactive)}"
case "$target_color" in
  blue|green) ;;
  *)
    echo "cutover: target color must be blue or green" >&2
    exit 2
    ;;
esac

target_service="api-${target_color}"
active_file="ops/nginx/upstreams/active.conf"

echo "cutover: ensuring target service is running ($target_service)"
docker compose up -d "$target_service"

container_id="$(docker compose ps -q "$target_service")"
if [ -z "$container_id" ]; then
  echo "cutover: could not resolve container id for $target_service" >&2
  exit 1
fi

i=0
while [ "$i" -lt 60 ]; do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
  if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$i" -ge 60 ]; then
  echo "cutover: $target_service failed health wait" >&2
  exit 1
fi

tmp_file="${active_file}.tmp"
printf 'server api-%s:3000;\n' "$target_color" > "$tmp_file"
mv "$tmp_file" "$active_file"

echo "cutover: reload nginx gateway"
docker compose exec -T gateway nginx -s reload

echo "cutover: update active db symlink"
docker compose run --rm --entrypoint sh backup -ec "ln -sfn kiel-${target_color}.duckdb /app/data/active.duckdb"

echo "cutover: verify gateway health"
curl -fsS http://127.0.0.1:3000/health >/dev/null

echo "cutover: traffic switched to $target_color"
