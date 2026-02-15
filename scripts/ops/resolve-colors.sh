#!/bin/sh
set -eu

active_file="${ACTIVE_UPSTREAM_FILE:-ops/nginx/upstreams/active.conf}"

if [ ! -f "$active_file" ]; then
  echo "resolve-colors: missing $active_file" >&2
  exit 1
fi

active_color=""
if grep -Eq 'api-blue:3000' "$active_file"; then
  active_color="blue"
elif grep -Eq 'api-green:3000' "$active_file"; then
  active_color="green"
else
  echo "resolve-colors: could not determine active color from $active_file" >&2
  exit 1
fi

if [ "$active_color" = "blue" ]; then
  inactive_color="green"
else
  inactive_color="blue"
fi

case "${1:-}" in
  --active)
    printf '%s\n' "$active_color"
    ;;
  --inactive)
    printf '%s\n' "$inactive_color"
    ;;
  "")
    printf 'ACTIVE_COLOR=%s\nINACTIVE_COLOR=%s\n' "$active_color" "$inactive_color"
    ;;
  *)
    echo "Usage: $0 [--active|--inactive]" >&2
    exit 2
    ;;
esac
