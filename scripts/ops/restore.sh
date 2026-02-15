#!/bin/sh
set -eu

if [ "${BACKUP_FILE:-}" = "" ]; then
  echo "restore: BACKUP_FILE is required" >&2
  exit 1
fi

duckdb_path="${DUCKDB_PATH:-data/kiel.duckdb}"
case "$duckdb_path" in
  /*) db_path="$duckdb_path" ;;
  *) db_path="/app/$duckdb_path" ;;
esac

src="/backups/$BACKUP_FILE"
if [ ! -f "$src" ]; then
  echo "restore: backup file not found: $src" >&2
  exit 1
fi

mkdir -p "$(dirname "$db_path")"
cp "$src" "$db_path"

if [ ! -s "$db_path" ]; then
  echo "restore: restore result is empty: $db_path" >&2
  exit 1
fi

echo "restore: restored $src to $db_path"
echo "restore: run migration job next: docker compose run --rm migrate"
