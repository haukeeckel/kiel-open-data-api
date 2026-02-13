import { describe, expect, it } from 'vitest';

import { withTestEnv } from '../test/helpers/env.js';

import { DEFAULT_HOST, DEFAULT_NODE_ENV, DEFAULT_PORT } from './constants.js';
import { getEnv } from './env.js';

describe('getEnv', () => {
  it('returns defaults when env vars are missing', () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: undefined,
      PORT: undefined,
      HOST: undefined,
      DUCKDB_PATH: undefined,
      CORS_ORIGIN: undefined,
      APP_VERSION: undefined,
      RATE_LIMIT_MAX: undefined,
      RATE_LIMIT_WINDOW_MS: undefined,
      DB_QUERY_TIMEOUT_MS: undefined,
    });

    try {
      const env = getEnv();

      expect(env.NODE_ENV).toBe(DEFAULT_NODE_ENV);
      expect(env.PORT).toBe(DEFAULT_PORT);
      expect(env.HOST).toBe(DEFAULT_HOST);
      expect(env.DUCKDB_PATH).toBeUndefined();
      expect(env.CORS_ORIGIN).toBe('*');
      expect(env.APP_VERSION).toBeDefined();
      expect(env.RATE_LIMIT_MAX).toBe(100);
      expect(env.RATE_LIMIT_WINDOW_MS).toBe(60_000);
      expect(env.DB_QUERY_TIMEOUT_MS).toBe(2_000);
    } finally {
      restoreEnv();
    }
  });

  it('parses env vars when provided', () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'production',
      PORT: 4000,
      HOST: '0.0.0.0',
      DUCKDB_PATH: '/tmp/test.duckdb',
      CORS_ORIGIN: 'https://example.com',
      APP_VERSION: '9.9.9',
      RATE_LIMIT_MAX: 50,
      RATE_LIMIT_WINDOW_MS: 5000,
      DB_QUERY_TIMEOUT_MS: 3210,
    });

    try {
      const env = getEnv();

      expect(env.NODE_ENV).toBe('production');
      expect(env.PORT).toBe(4000);
      expect(env.HOST).toBe('0.0.0.0');
      expect(env.DUCKDB_PATH).toBe('/tmp/test.duckdb');
      expect(env.CORS_ORIGIN).toBe('https://example.com');
      expect(env.APP_VERSION).toBe('9.9.9');
      expect(env.RATE_LIMIT_MAX).toBe(50);
      expect(env.RATE_LIMIT_WINDOW_MS).toBe(5000);
      expect(env.DB_QUERY_TIMEOUT_MS).toBe(3210);
    } finally {
      restoreEnv();
    }
  });
});
