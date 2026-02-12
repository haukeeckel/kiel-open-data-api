# kiel-dashboard-api

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
pnpm build
pnpm start
```

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
  Port to listen on (default: `3000`)

- `DUCKDB_PATH`
  Path to DuckDB database file (default: `data/kiel.<env>.duckdb`, e.g. `data/kiel.development.duckdb`)
  For tests we use `:memory:` to avoid lock conflicts.

- `CORS_ORIGIN`
  Allowed CORS origin (default: `*` in non-production; required in production)

- `APP_VERSION`
  App version reported by the API (default: `npm_package_version` or `0.0.0`)

- `RATE_LIMIT_MAX`
  Max requests per window (default: `100`)

- `RATE_LIMIT_WINDOW_MS`
  Rate limit window in ms (default: `60000`)

- `SWAGGER_ROUTE_PREFIX`
  Swagger UI route prefix (default: `/docs`)

- `SWAGGER_UI_ENABLED`
  Enable Swagger UI (default: `true` for non-production, `false` for production)

## Data & DuckDB

This project uses DuckDB as an embedded analytics database. The DB file is stored under:

- `data/kiel.duckdb` (ignored by git)
- download/cache files under `data/cache/` (ignored by git)

### ETL (Dataset-basiert)

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
```

### Statistics schema

ETL writes into a normalized (tidy) table:

`statistics(indicator, area_type, area_name, year, value, unit, category)`

Example:

- indicator: `population`
- area_type: `district`
- area_name: `Altstadt`
- year: `2023`
- value: `1220`
- unit: `persons`
- category: `total`

## API Endpoints

- `GET /`
  Simple endpoint list

- `GET /health`
  Health check

- `GET /v1/timeseries`
  Time series for a given indicator and area

- `GET /v1/areas`
  List distinct areas for an indicator and area type

- `GET /v1/categories`
  List distinct categories for an indicator and area type

- `GET /v1/ranking`
  Ranking of areas by value for a given indicator/year

## Notes

- Local DB tools (Beekeeper, etc.) can lock `data/kiel.duckdb`. If you see lock errors,
  close the tool or set `DUCKDB_PATH` to another file. Tests already use `:memory:`.
- If you want the API to be reachable from other devices in your network, set:
  `HOST=0.0.0.0` (be aware this exposes the service in your LAN).
