# kiel-dashboard-api

Backend/API for a small city dashboard prototype based on Kiel Open Data.

## Requirements

- Node.js (LTS recommended, e.g. 20)
- pnpm

## Setup

```bash
pnpm install
```

## Development

Start the dev server (watch mode):

```bash
pnpm dev
```

Server listens on:

- `http://127.0.0.1:3000` (default)

### Endpoints

- `GET /` – basic info + endpoints list
- `GET /health` – health check
- `GET /db-test` – DuckDB smoke check (`SELECT 42 AS answer`)

## Production build

Build:

```bash
pnpm build
```

Run:

```bash
pnpm start
```

## Configuration

Environment variables (all optional, defaults are applied):

- `HOST` (default: `127.0.0.1`)
- `PORT` (default: `3000`)
- `NODE_ENV` (`development` | `test` | `production`)

Example:

```bash
HOST=0.0.0.0 PORT=3000 pnpm dev
```

## Quality checks

Lint:

```bash
pnpm lint
```

Typecheck:

```bash
pnpm typecheck
```

Format check:

```bash
pnpm format:check
```

Auto-format:

```bash
pnpm format
```

## Tests

Run tests once:

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

## CI

CI runs on pull requests and on pushes to `main`:

- format check
- lint
- typecheck
- test
- build

## Git workflow

We use feature branches + PRs and Conventional Commits.
See: [`docs/git-convention.md`](docs/git-convention.md)
