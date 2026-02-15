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
tmp_file="${active_file}.tmp"
backup_file="${active_file}.bak"
previous_color="$(./scripts/ops/resolve-colors.sh --active)"

cleanup() {
  rm -f "$tmp_file" "$backup_file"
}

rollback_to_previous() {
  echo "cutover: rolling back to $previous_color" >&2
  if [ -f "$backup_file" ]; then
    cp "$backup_file" "$active_file"
  fi
  docker compose exec -T gateway nginx -s reload || true
  docker compose run --rm --entrypoint sh backup -ec "ln -sfn kiel-${previous_color}.duckdb /app/data/active.duckdb" || true
}

trap cleanup EXIT

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

cp "$active_file" "$backup_file"
printf 'server api-%s:3000;\n' "$target_color" > "$tmp_file"
mv "$tmp_file" "$active_file"

echo "cutover: reload nginx gateway"
if ! docker compose exec -T gateway nginx -s reload; then
  echo "cutover: gateway reload failed; reverting active upstream" >&2
  rollback_to_previous
  exit 1
fi

echo "cutover: update active db symlink"
if ! docker compose run --rm --entrypoint sh backup -ec "ln -sfn kiel-${target_color}.duckdb /app/data/active.duckdb"; then
  echo "cutover: active db symlink update failed; reverting cutover" >&2
  rollback_to_previous
  exit 1
fi

echo "cutover: verify gateway health"
if ! curl -fsS http://127.0.0.1:3000/health >/dev/null; then
  echo "cutover: post-cutover healthcheck failed; reverting cutover" >&2
  rollback_to_previous
  exit 1
fi

echo "cutover: traffic switched to $target_color"
