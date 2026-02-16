# kiel-open-data-api

Backend/API + ETL pipeline for Kiel Open Data.

## Requirements

- Node.js (recommended: LTS)
- pnpm

## Quickstart

Install dependencies:

```bash
pnpm install
```

Run the API in dev mode:

```bash
pnpm dev
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

## Scripts

### Development

```bash
pnpm dev
```

### Lint / Format / Typecheck

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm format
```

### Tests

```bash
pnpm test
```

> Note: Tests run DuckDB using `:memory:` (in-memory database) to avoid file locks
> (e.g. when the local DuckDB file is open in Beekeeper Studio).

### Build & Run

```bash
pnpm migrate
pnpm build
pnpm start
```

## Database Migrations

Run migrations explicitly before starting the API:

```bash
pnpm migrate
```

Recommended local sequence:

1. `pnpm migrate`
2. `pnpm start` (or `pnpm dev`)

Recommended deployment sequence:

1. Run migration job (`pnpm migrate`) once.
2. Roll out application instances.

The API no longer applies migrations automatically at startup. This avoids
concurrent migration attempts in multi-instance deployments.

## Configuration

Copy the example env file and adjust if needed:

```bash
cp .env.example .env
```

### Environment variables

- `NODE_ENV`
  One of: `development`, `test`, `production` (default: `development`)

- `HOST`
  Host interface to bind to (default: `127.0.0.1`)

- `PORT`
  Port to listen on (default: `3000`, valid range: `1-65535`)

- `DUCKDB_PATH`
  Optional path override for DuckDB database file.
  If unset, default is `data/kiel.<env>.duckdb` (e.g. `data/kiel.development.duckdb`)
  For tests we use `:memory:` to avoid lock conflicts.

- `CORS_ORIGIN`
  Allowed CORS origin (default: `*` in non-production; required in production)

- `APP_VERSION`
  App version reported by the API (default: `npm_package_version` or `0.0.0`)

- `RATE_LIMIT_MAX`
  Max requests per window (default: `100`)

- `RATE_LIMIT_WINDOW_MS`
  Rate limit window in ms (default: `60000`)

- `DB_QUERY_TIMEOUT_MS`
  DB query timeout in ms for repository operations (default: `2000`)

- `DB_POOL_SIZE`
  Number of DB connections in the pool (default: `4`, valid range: `1-64`)

- `DB_POOL_ACQUIRE_TIMEOUT_MS`
  Max wait time in ms to acquire a pooled connection (default: `2000`)

- `STATS_VALIDATION_CACHE_ENABLED`
  Enable in-memory TTL cache for domain validation lookups (default: `true`)

- `STATS_VALIDATION_CACHE_TTL_MS`
  TTL in ms for validation cache entries (default: `30000`).
  Invalidation is TTL-only (no live ETL publish hook in API process).

- `METRICS_ENABLED`
  Enable `/metrics` endpoint (default: `false` in production, `true` otherwise)

- `METRICS_TOKEN`
  Optional shared token required to access `/metrics`

- `METRICS_AUTH_HEADER`
  Header carrying metrics token (default: `x-metrics-token`)

- `OBS_SLOW_QUERY_THRESHOLD_MS`
  Slow-query warning threshold in ms for repository observability (default: `500`)

- `OBS_PLAN_SAMPLE_ENABLED`
  Enables slow-query plan-sampling scaffold logs (default: `false`)

- `SWAGGER_ROUTE_PREFIX`
  Swagger UI route prefix (default: `/docs`)

- `SWAGGER_UI_ENABLED`
  Enable Swagger UI (default: `true` for non-production, `false` for production).
  Allowed values: `true` or `false` (case-insensitive); other values fail on startup.

## Data & DuckDB

This project uses DuckDB as an embedded analytics database. The DB file is stored under:

- `data/kiel.duckdb` (ignored by git)
- download/cache files under `data/cache/` (ignored by git)

### ETL (Dataset-basiert)

Important: ETL does not apply migrations automatically.
Run `pnpm migrate` before any `pnpm etl:*` command.

Fetch and import all configured datasets into DuckDB:

```bash
pnpm etl:run
```

Fetch all datasets only:

```bash
pnpm etl:fetch
```

Import all datasets only (expects CSVs in cache):

```bash
pnpm etl:import
```

Run a single dataset by id:

```bash
pnpm etl:run:dataset districts_population
pnpm etl:run:dataset districts_households_type_size
pnpm etl:run:dataset districts_marital_status
pnpm etl:run:dataset districts_gender
pnpm etl:run:dataset districts_age_groups
pnpm etl:run:dataset districts_area_hectares
pnpm etl:run:dataset districts_unemployed_count
pnpm etl:run:dataset districts_unemployed_rate
pnpm etl:run:dataset districts_religion
pnpm etl:run:dataset districts_foreign_nationalities_selected
pnpm etl:run:dataset districts_foreign_age_groups
pnpm etl:run:dataset districts_foreign_gender
pnpm etl:run:dataset districts_foreign_count
pnpm etl:run:dataset districts_migrant_gender
pnpm etl:run:dataset postal_codes_population
pnpm etl:run:dataset subdistricts_population
pnpm etl:run:dataset subdistricts_age_groups
pnpm etl:run:dataset subdistricts_gender
pnpm etl:run:dataset subdistricts_foreign_gender
pnpm etl:run:dataset subdistricts_migrant_gender
```

ETL maintenance planning (dry-run only, no data changes):

```bash
pnpm etl:maint:dry-run
```

### Statistics schema

ETL writes into a normalized (tidy) table:

`statistics(indicator, area_type, area_name, year, value, unit, category, source_dataset, import_run_id, loaded_at, data_version)`

Example:

- indicator: `population`
- area_type: `district`
- area_name: `Altstadt`
- year: `2023`
- value: `1220`
- unit: `persons`
- category: `total`
- source_dataset: `districts_population`
- import_run_id: UUID for ETL run tracking
- loaded_at: timestamp when row was imported
- data_version: import source version fingerprint

### ETL run metadata

ETL writes one run record per dataset execution into `etl_runs`:

- `status`: `started`, `published`, `failed`
- `started_at`, `published_at`, `failed_at`
- `row_count` on successful publish
- `error_message` on failed runs

## API Endpoints

- `GET /`
  Simple endpoint list

- `GET /health`
  Health check

- `GET /v1/timeseries`
  Time series for a given indicator and area(s).
  `areas` supports CSV (for example `Altstadt,Gaarden-Ost`).
  Optional `categories` supports CSV (for example `male,female`).
  If `categories` is omitted, rows from all categories are returned.
  Response uses `areas: string[]` and each row includes `area`.

- `GET /v1/areas`
  List distinct areas for an indicator and area type.
  If `category` is omitted, areas across all categories are returned.

- `GET /v1/categories`
  List distinct categories for an indicator and area type

- `GET /v1/ranking`
  Ranking of areas by value for a given indicator/year.
  Optional `categories` supports CSV and optional `areas` supports CSV.
  If `categories` is omitted, ranking rows can contain mixed categories.

- `GET /v1/indicators`
  List distinct indicators.
  Optional reverse-lookup filters: `areaType`, `area`, `year`.
  `area` can be used with or without `areaType`.

- `GET /v1/indicators/:indicator`
  Grouped indicator metadata by area type, including available years, categories, and areas.
  Returns `404` if the indicator does not exist.

- `GET /v1/years`
  List distinct years.
  Optional discovery filters: `indicator`, `areaType`, `category`, `area`.
  Empty matches return `200` with `rows: []`.

- `GET /v1/years/:year`
  Grouped year metadata by area type, including available indicators, categories, and areas.
  Returns `404` if the year does not exist.

### HTTP Caching and Freshness Headers (`/v1/*`)

All `GET /v1/*` endpoints support conditional requests:

- Response headers:
  - `ETag`
  - `Cache-Control: public, max-age=60`
  - `Data-Version`
  - `Last-Updated-At` (if available)
- Request header:
  - `If-None-Match`

When `If-None-Match` matches the current `ETag`, the API returns `304 Not Modified`
with an empty body.

Example:

```bash
# first request
curl -i "http://127.0.0.1:3000/v1/areas?indicator=population&areaType=district"

# conditional revalidation
curl -i \
  -H 'If-None-Match: "<etag-from-first-response>"' \
  "http://127.0.0.1:3000/v1/areas?indicator=population&areaType=district"
```

## Metrics Exposure

`/metrics` is intentionally controlled:

- Disabled in production by default.
- Enabled explicitly via `METRICS_ENABLED=true`.
- If `METRICS_TOKEN` is set, requests must provide the configured auth header
  (`METRICS_AUTH_HEADER`, default `x-metrics-token`).

Example:

```bash
curl -H "x-metrics-token: $METRICS_TOKEN" http://127.0.0.1:3000/metrics
```

## Docker / Compose Betrieb (Blue/Green DuckDB)

This repository includes a Docker Compose blue/green operating baseline:

- `gateway` (nginx) serves traffic on port `3000`
- `api-blue` uses `data/kiel-blue.duckdb`
- `api-green` uses `data/kiel-green.duckdb`
- jobs: `migrate`, `etl`, `backup`, `restore`
- traffic cutover is done via `ops/nginx/upstreams/active.conf`

### Prod default (recommended)

Set required CORS origin and start services:

```bash
export CORS_ORIGIN=https://your-frontend.example
docker compose build
docker compose up -d gateway api-blue api-green
curl http://127.0.0.1:3000/health
```

Swagger UI (`/docs`) stays disabled by default in production profile.
Enable it explicitly if needed:

```bash
export SWAGGER_UI_ENABLED=true
docker compose up -d gateway api-blue api-green
```

### Dev-style compose start

Use development env defaults with Swagger enabled:

```bash
export NODE_ENV=development
export CORS_ORIGIN=http://localhost:3000
export SWAGGER_UI_ENABLED=true
docker compose up -d gateway api-blue api-green
```

Swagger UI is then available at:
`http://127.0.0.1:3000/docs`

Prepare inactive color (backup + migrate + ETL + health):

```bash
./scripts/ops/etl-bluegreen.sh
```

Switch traffic to inactive color:

```bash
./scripts/ops/cutover.sh
```

Rollback to previous color:

```bash
./scripts/ops/rollback.sh
```

Restore from backup (writes to `data/active.duckdb` symlink target):

```bash
docker compose run --rm -e BACKUP_FILE=<backup-file> restore
```

Detailed operational flow and troubleshooting:
`docs/runbook-docker.md`.

## Test Fixture Maintenance

Statistics seed data for integration tests is maintained as structured fixtures:

- `src/test/fixtures/statisticsSeed.ts`
- `src/test/helpers/statisticsSeedBuilder.ts`

When extending seed data:

1. Add records to `statisticsSeedRows`.
2. Keep record shape consistent (`indicator`, `areaType`, `areaName`, `year`, `value`, `unit`, `category`).
3. Avoid reintroducing large inline SQL blocks in test helpers.

General fixture convention:

1. Large or reusable fixture data from `*.test.ts` should live in `src/test/fixtures/`.
2. Prefer one fixture module per test context (for example `statisticsRoute.fixtures.ts`).
3. Keep tiny, test-local one-off values inline where that improves readability.

## Notes

- If you want the API to be reachable from other devices in your network, set:
  `HOST=0.0.0.0` (be aware this exposes the service in your LAN).
