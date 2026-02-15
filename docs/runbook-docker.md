# Docker Runbook (DuckDB Stateful Betrieb)

This runbook defines the baseline operation for Docker Compose v2.

## Services

- `api`: HTTP API service
- `migrate`: one-shot migration job (`pnpm migrate`)
- `etl`: one-shot ETL job (`pnpm etl:run`)
- `backup`: one-shot DuckDB snapshot job
- `restore`: one-shot restore job (requires `BACKUP_FILE`)
- `etl-cron`: optional ETL loop service (`--profile cron`)

## Volumes

- `duckdb_data` -> `/app/data`
- `etl_cache` -> `/app/data/cache`
- `duckdb_backups` -> `/backups`

Default DB location inside container:
`DUCKDB_PATH=data/kiel.duckdb`

Production mode requires `CORS_ORIGIN`. Compose sets a default:
`CORS_ORIGIN=http://localhost:3000`.
Override it for your real frontend origin in production.

## 1. Build

```bash
docker compose build
```

## 2. Initial Setup (fresh environment)

Run migrations before starting API:

```bash
docker compose run --rm migrate
docker compose up -d api
```

Verify:

```bash
curl http://127.0.0.1:3000/health
```

## 3. Manual ETL Standard Flow

For ETL, stop API first to avoid DuckDB file lock conflicts.
Always create a backup snapshot before ETL:

```bash
docker compose stop api
docker compose run --rm backup
docker compose run --rm etl
docker compose up -d api
```

This is the default production-safe flow for this baseline.

## 4. Backup Details

Backup service uses:

- `BACKUP_FILE_PREFIX` (default: `kiel`)
- `BACKUP_RETENTION_COUNT` (default: `10`)

Example with custom retention:

```bash
docker compose run --rm -e BACKUP_RETENTION_COUNT=20 backup
```

## 5. Restore Flow

1. Stop API:

```bash
docker compose stop api
```

2. List available snapshots:

```bash
docker compose run --rm backup sh -c "ls -1 /backups"
```

3. Restore one snapshot:

```bash
docker compose run --rm -e BACKUP_FILE=<backup-file> restore
```

4. Re-run migrations and start API:

```bash
docker compose run --rm migrate
docker compose up -d api
```

## 6. Optional Cron Profile

Cron-like ETL is optional and disabled by default.

Enable:

```bash
docker compose --profile cron up -d etl-cron
```

Disable:

```bash
docker compose --profile cron stop etl-cron
docker compose --profile cron rm -f etl-cron
```

Change interval (seconds):

```bash
docker compose --profile cron run --rm -e ETL_CRON_INTERVAL_SEC=43200 etl-cron
```

## 7. Caching Baseline

No external cache service is used in this baseline.

- API validation cache is controlled via:
  - `STATS_VALIDATION_CACHE_ENABLED`
  - `STATS_VALIDATION_CACHE_TTL_MS`
- ETL download cache is persisted in `etl_cache` volume.

## 8. Operational Guardrails

- DuckDB file access is process-exclusive in this setup. Keep only one DB process active.
- Do not run `migrate` and `etl` concurrently.
- Stop `api` before running `migrate`, `etl`, or `restore`.
- Keep backup-before-ETL as standard procedure.
- Prefer one writer pattern for DuckDB jobs to avoid lock contention.

## 9. Troubleshooting

Healthcheck failing:

1. `docker compose logs api`
2. Ensure migration was executed: `docker compose run --rm migrate`
3. Verify `DUCKDB_PATH` points to mounted data directory.

DuckDB lock errors:

1. Stop API and all concurrent jobs (`etl`, `migrate`, external DB tools).
2. Retry with strict sequence: `migrate` -> `api`.
3. For ETL: `stop api` -> `backup` -> `etl` -> `start api`.

Restore errors:

1. Check file exists: `docker compose run --rm backup sh -c "ls -1 /backups"`
2. Retry with exact `BACKUP_FILE` value.
