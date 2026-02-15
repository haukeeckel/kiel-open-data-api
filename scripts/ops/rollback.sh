#!/bin/sh
set -eu

rollback_color="${1:-$(./scripts/ops/resolve-colors.sh --inactive)}"

case "$rollback_color" in
  blue|green) ;;
  *)
    echo "rollback: color must be blue or green" >&2
    exit 2
    ;;
esac

echo "rollback: switching traffic to $rollback_color"
./scripts/ops/cutover.sh "$rollback_color"
