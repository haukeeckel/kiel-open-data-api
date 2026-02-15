import { describe, expect, it } from 'vitest';

import { withTestEnv } from '../test/helpers/env.js';

import { DEFAULT_HOST, DEFAULT_NODE_ENV, DEFAULT_PORT } from './constants.js';
import { getEnv, resetEnvForTests } from './env.js';

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
      DB_POOL_SIZE: undefined,
      DB_POOL_ACQUIRE_TIMEOUT_MS: undefined,
      STATS_VALIDATION_CACHE_ENABLED: undefined,
      STATS_VALIDATION_CACHE_TTL_MS: undefined,
      METRICS_ENABLED: undefined,
      METRICS_TOKEN: undefined,
      METRICS_AUTH_HEADER: undefined,
      OBS_SLOW_QUERY_THRESHOLD_MS: undefined,
      OBS_PLAN_SAMPLE_ENABLED: undefined,
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
      expect(env.DB_POOL_SIZE).toBe(4);
      expect(env.DB_POOL_ACQUIRE_TIMEOUT_MS).toBe(2_000);
      expect(env.STATS_VALIDATION_CACHE_ENABLED).toBe(true);
      expect(env.STATS_VALIDATION_CACHE_TTL_MS).toBe(30_000);
      expect(env.METRICS_ENABLED).toBe(true);
      expect(env.METRICS_TOKEN).toBeUndefined();
      expect(env.METRICS_AUTH_HEADER).toBe('x-metrics-token');
      expect(env.OBS_SLOW_QUERY_THRESHOLD_MS).toBe(500);
      expect(env.OBS_PLAN_SAMPLE_ENABLED).toBe(false);
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
      DB_POOL_SIZE: 8,
      DB_POOL_ACQUIRE_TIMEOUT_MS: 1500,
      STATS_VALIDATION_CACHE_ENABLED: false,
      STATS_VALIDATION_CACHE_TTL_MS: 12_345,
      METRICS_ENABLED: true,
      METRICS_TOKEN: 'secret',
      METRICS_AUTH_HEADER: 'x-custom-token',
      OBS_SLOW_QUERY_THRESHOLD_MS: 750,
      OBS_PLAN_SAMPLE_ENABLED: true,
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
      expect(env.DB_POOL_SIZE).toBe(8);
      expect(env.DB_POOL_ACQUIRE_TIMEOUT_MS).toBe(1500);
      expect(env.STATS_VALIDATION_CACHE_ENABLED).toBe(false);
      expect(env.STATS_VALIDATION_CACHE_TTL_MS).toBe(12_345);
      expect(env.METRICS_ENABLED).toBe(true);
      expect(env.METRICS_TOKEN).toBe('secret');
      expect(env.METRICS_AUTH_HEADER).toBe('x-custom-token');
      expect(env.OBS_SLOW_QUERY_THRESHOLD_MS).toBe(750);
      expect(env.OBS_PLAN_SAMPLE_ENABLED).toBe(true);
    } finally {
      restoreEnv();
    }
  });

  it('defaults METRICS_ENABLED to false in production', () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      METRICS_ENABLED: undefined,
    });

    try {
      const env = getEnv();
      expect(env.METRICS_ENABLED).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('parses SWAGGER_UI_ENABLED=true', () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'development',
      CORS_ORIGIN: undefined,
      SWAGGER_UI_ENABLED: undefined,
    });
    process.env['SWAGGER_UI_ENABLED'] = 'true';
    resetEnvForTests();

    try {
      const env = getEnv();
      expect(env.SWAGGER_UI_ENABLED).toBe(true);
    } finally {
      restoreEnv();
    }
  });

  it('parses SWAGGER_UI_ENABLED case-insensitively', () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'development',
      CORS_ORIGIN: undefined,
      SWAGGER_UI_ENABLED: undefined,
    });
    process.env['SWAGGER_UI_ENABLED'] = 'FALSE';
    resetEnvForTests();

    try {
      const env = getEnv();
      expect(env.SWAGGER_UI_ENABLED).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('throws for invalid SWAGGER_UI_ENABLED values', () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'development',
      CORS_ORIGIN: undefined,
      SWAGGER_UI_ENABLED: undefined,
    });
    process.env['SWAGGER_UI_ENABLED'] = 'yes';
    resetEnvForTests();

    try {
      expect(() => getEnv()).toThrow();
    } finally {
      restoreEnv();
    }
  });

  it('accepts PORT=65535', () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'development',
      CORS_ORIGIN: undefined,
      PORT: 65535,
    });

    try {
      const env = getEnv();
      expect(env.PORT).toBe(65535);
    } finally {
      restoreEnv();
    }
  });

  it('throws for PORT=65536', () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'development',
      CORS_ORIGIN: undefined,
      PORT: 65536,
    });

    try {
      expect(() => getEnv()).toThrow();
    } finally {
      restoreEnv();
    }
  });

  it('resolves dotenv behavior per getEnv call after NODE_ENV changes', () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'test',
      CORS_ORIGIN: undefined,
      SWAGGER_UI_ENABLED: undefined,
    });

    try {
      let env = getEnv();
      expect(env.NODE_ENV).toBe('test');

      process.env['NODE_ENV'] = 'development';
      resetEnvForTests();

      env = getEnv();
      expect(env.NODE_ENV).toBe('development');
    } finally {
      restoreEnv();
    }
  });
});
