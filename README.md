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
  Path to DuckDB database file (default: `data/kiel.duckdb`)
  For tests we use `:memory:` to avoid lock conflicts.

## Data & DuckDB

This project uses DuckDB as an embedded analytics database. The DB file is stored under:

- `data/kiel.duckdb` (ignored by git)
- download/cache files under `data/cache/` (ignored by git)

### ETL (Stadtteile Bevölkerung)

Fetch and import the dataset into DuckDB:

```bash
pnpm etl:run
```

Fetch only:

```bash
pnpm etl:fetch
```

Import only (expects CSV in cache):

```bash
pnpm etl:import
```

### Facts schema

ETL writes into a normalized (tidy) table:

`facts(indicator, area_type, area_name, year, value, unit)`

Example:

- indicator: `population`
- area_type: `district`
- area_name: `Altstadt`
- year: `2023`
- value: `1220`
- unit: `persons`

## API Endpoints

- `GET /`
  Simple endpoint list

- `GET /health`
  Health check

- `GET /db-test`
  DuckDB smoke test (returns `{ rows: [{ answer: 42 }] }`)

## Notes

- Local DB tools (Beekeeper, etc.) can lock `data/kiel.duckdb`. If you see lock errors,
  close the tool or set `DUCKDB_PATH` to another file. Tests already use `:memory:`.
- If you want the API to be reachable from other devices in your network, set:
  `HOST=0.0.0.0` (be aware this exposes the service in your LAN).
