# Docker Runbook (Blue/Green DuckDB Betrieb)

This runbook defines zero-downtime cutover for Docker Compose v2.

## Services

- `gateway`: nginx entrypoint on `:3000`
- `api-blue`: API bound to `data/kiel-blue.duckdb`
- `api-green`: API bound to `data/kiel-green.duckdb`
- `migrate`: one-shot migration job for `TARGET_COLOR`
- `etl`: one-shot ETL job for `TARGET_COLOR`
- `backup`: one-shot snapshot job (default DB path: `data/active.duckdb`)
- `restore`: one-shot restore job (requires `BACKUP_FILE`)

## Volumes

- `duckdb_data` -> `/app/data`
- `etl_cache` -> `/app/data/cache`
- `duckdb_backups` -> `/backups`

## Config files

- `ops/nginx/upstreams/active.conf` decides current live color
- `scripts/ops/resolve-colors.sh` reads active/inactive color

## 1. Build and bootstrap

Set required CORS origin for production-profile compose services:

```bash
export CORS_ORIGIN=https://your-frontend.example
```

```bash
docker compose build
docker compose up -d api-blue api-green gateway
```

Swagger UI in production-profile compose is disabled by default.
Enable it explicitly only when needed:

```bash
export SWAGGER_UI_ENABLED=true
docker compose up -d api-blue api-green gateway
```

For a dev-style compose start:

```bash
export NODE_ENV=development
export CORS_ORIGIN=http://localhost:3000
export SWAGGER_UI_ENABLED=true
docker compose up -d api-blue api-green gateway
```

Set initial active side (default file points to blue):

```bash
./scripts/ops/cutover.sh blue
curl http://127.0.0.1:3000/health
```

## 2. Standard refresh cycle (no downtime)

Prepare inactive color:

```bash
./scripts/ops/etl-bluegreen.sh
```

This runs:

1. backup of active DB
2. `migrate` on inactive color
3. `etl` on inactive color
4. start/check inactive API service

Cut over traffic:

```bash
./scripts/ops/cutover.sh
```

## 3. Rollback

Rollback to previous color:

```bash
./scripts/ops/rollback.sh
```

Or explicitly choose color:

```bash
./scripts/ops/rollback.sh blue
./scripts/ops/rollback.sh green
```

## 4. Job commands (manual)

Run migration on one color:

```bash
docker compose run --rm -e TARGET_COLOR=blue migrate
docker compose run --rm -e TARGET_COLOR=green migrate
```

Run ETL on one color:

```bash
docker compose run --rm -e TARGET_COLOR=blue etl
docker compose run --rm -e TARGET_COLOR=green etl
```

## 5. Backup and restore

Create backup from active DB marker:

```bash
docker compose run --rm backup
```

Restore from backup file:

```bash
docker compose run --rm -e BACKUP_FILE=<backup-file> restore
```

After restore, run migration on target color and cut over if needed.

## 6. Caching baseline

No external cache service is used.

- API validation cache:
  - `STATS_VALIDATION_CACHE_ENABLED`
  - `STATS_VALIDATION_CACHE_TTL_MS`
- ETL download cache remains on persistent `etl_cache` volume.

## 7. Guardrails

- Do not run ETL and migration against the same color concurrently.
- Always ETL into inactive color first.
- Cut over only after inactive API is healthy.
- Keep `active.conf` and DB symlink (`/app/data/active.duckdb`) aligned via `cutover.sh`.

## 8. Troubleshooting

Gateway not healthy:

1. `docker compose logs gateway`
2. validate nginx config mount (`ops/nginx/*`)
3. ensure at least one API service is healthy

Color resolution issues:

1. `cat ops/nginx/upstreams/active.conf`
2. `./scripts/ops/resolve-colors.sh`

Cutover health failures:

1. `docker compose logs api-blue`
2. `docker compose logs api-green`
3. rerun ETL on inactive side, then retry cutover

DuckDB lock errors:

- Ensure no out-of-band tools hold DB files
- Ensure jobs target inactive color, not active color
