import type { Env } from '../../config/env.js';

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    HOST: '127.0.0.1',
    DUCKDB_PATH: undefined,
    CORS_ORIGIN: '*',
    APP_VERSION: '0.0.0',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60_000,
    DB_QUERY_TIMEOUT_MS: 2_000,
    DB_POOL_SIZE: 4,
    DB_POOL_ACQUIRE_TIMEOUT_MS: 2_000,
    SWAGGER_ROUTE_PREFIX: '/docs',
    SWAGGER_UI_ENABLED: true,
    ...overrides,
  };
}
