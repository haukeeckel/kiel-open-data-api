#!/bin/sh
set -eu

prefix="${BACKUP_FILE_PREFIX:-kiel}"
retention="${BACKUP_RETENTION_COUNT:-10}"
duckdb_path="${DUCKDB_PATH:-data/active.duckdb}"

case "$duckdb_path" in
  /*) db_path="$duckdb_path" ;;
  *) db_path="/app/$duckdb_path" ;;
esac

if [ ! -f "$db_path" ]; then
  echo "backup: source database not found: $db_path" >&2
  exit 1
fi

echo "backup: checkpoint source database before snapshot"
DB_PATH="$db_path" node --input-type=module -e "
import { DuckDBInstance } from '@duckdb/node-api';
const dbPath = process.env.DB_PATH;
if (!dbPath) throw new Error('backup: DB_PATH is required');
const db = await DuckDBInstance.create(dbPath);
const conn = await db.connect();
try {
  await conn.run('CHECKPOINT');
} finally {
  try { conn.closeSync(); } catch {}
  try { db.closeSync(); } catch {}
}
"

ts="$(date +%Y%m%d-%H%M%S)"
out="/backups/${prefix}-${ts}.duckdb"

cp "$db_path" "$out"

if [ ! -s "$out" ]; then
  echo "backup: output file invalid or empty: $out" >&2
  exit 1
fi

case "$retention" in
  ''|*[!0-9]*) retention=10 ;;
esac

if [ "$retention" -gt 0 ]; then
  set -- /backups/"$prefix"-*.duckdb
  if [ -e "$1" ]; then
    files="$(ls -1 /backups/"$prefix"-*.duckdb | sort)"
    count="$(printf '%s\n' "$files" | wc -l | tr -d ' ')"
    if [ "$count" -gt "$retention" ]; then
      remove_count=$((count - retention))
      printf '%s\n' "$files" | head -n "$remove_count" | while IFS= read -r file; do
        [ -n "$file" ] && rm -f "$file"
      done
    fi
  fi
fi

echo "backup: created $out"
