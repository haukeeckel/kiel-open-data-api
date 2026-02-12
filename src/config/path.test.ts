import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getCacheDir, getDataDir, getDuckDbPath } from './path.js';

import type { Env } from './env.js';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'development',
    PORT: 3000,
    HOST: '127.0.0.1',
    DUCKDB_PATH: undefined,
    CORS_ORIGIN: '*',
    APP_VERSION: '0.0.0',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60_000,
    SWAGGER_ROUTE_PREFIX: '/docs',
    SWAGGER_UI_ENABLED: true,
    ...overrides,
  };
}

describe('config path helpers', () => {
  it('builds cache dir under data/cache', () => {
    expect(getCacheDir()).toBe(path.join(process.cwd(), 'data', 'cache'));
  });

  it('builds data dir under data', () => {
    expect(getDataDir()).toBe(path.join(process.cwd(), 'data'));
  });

  it('resolves relative DUCKDB_PATH under data dir', () => {
    const env = makeEnv({ DUCKDB_PATH: 'custom.duckdb' });
    expect(getDuckDbPath(env)).toBe(path.resolve(process.cwd(), 'data', 'custom.duckdb'));
  });

  it('resolves relative DUCKDB_PATH with path segments from cwd', () => {
    const env = makeEnv({ DUCKDB_PATH: './data/kiel_dashboard.duckdb' });
    expect(getDuckDbPath(env)).toBe(path.resolve(process.cwd(), 'data', 'kiel_dashboard.duckdb'));
  });

  it('keeps absolute DUCKDB_PATH', () => {
    const env = makeEnv({ DUCKDB_PATH: '/tmp/custom.duckdb' });
    expect(getDuckDbPath(env)).toBe(path.resolve('/tmp/custom.duckdb'));
  });

  it('uses env-based default filename when DUCKDB_PATH is not set', () => {
    const prod = makeEnv({ NODE_ENV: 'production', DUCKDB_PATH: undefined });
    expect(getDuckDbPath(prod)).toBe(path.resolve(process.cwd(), 'data', 'kiel.duckdb'));

    const dev = makeEnv({ NODE_ENV: 'development', DUCKDB_PATH: undefined });
    expect(getDuckDbPath(dev)).toBe(path.resolve(process.cwd(), 'data', 'kiel.development.duckdb'));
  });
});
