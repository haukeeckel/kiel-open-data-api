import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_HOST, DEFAULT_NODE_ENV, DEFAULT_PORT } from './constants';
import { getEnv, resetEnvForTests } from './env';

function clearEnv(keys: string[]) {
  for (const key of keys) {
    delete process.env[key];
  }
}

describe('getEnv', () => {
  afterEach(() => {
    resetEnvForTests();
    clearEnv([
      'NODE_ENV',
      'PORT',
      'HOST',
      'DUCKDB_PATH',
      'CORS_ORIGIN',
      'APP_VERSION',
      'RATE_LIMIT_MAX',
      'RATE_LIMIT_WINDOW_MS',
    ]);
  });

  it('returns defaults when env vars are missing', () => {
    clearEnv([
      'NODE_ENV',
      'PORT',
      'HOST',
      'DUCKDB_PATH',
      'CORS_ORIGIN',
      'APP_VERSION',
      'RATE_LIMIT_MAX',
      'RATE_LIMIT_WINDOW_MS',
    ]);

    const env = getEnv();

    expect(env.NODE_ENV).toBe(DEFAULT_NODE_ENV);
    expect(env.PORT).toBe(DEFAULT_PORT);
    expect(env.HOST).toBe(DEFAULT_HOST);
    expect(env.DUCKDB_PATH).toBeUndefined();
    expect(env.CORS_ORIGIN).toBe('*');
    expect(env.APP_VERSION).toBeDefined();
    expect(env.RATE_LIMIT_MAX).toBe(100);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(60_000);
  });

  it('parses env vars when provided', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PORT'] = '4000';
    process.env['HOST'] = '0.0.0.0';
    process.env['DUCKDB_PATH'] = '/tmp/test.duckdb';
    process.env['CORS_ORIGIN'] = 'https://example.com';
    process.env['APP_VERSION'] = '9.9.9';
    process.env['RATE_LIMIT_MAX'] = '50';
    process.env['RATE_LIMIT_WINDOW_MS'] = '5000';

    resetEnvForTests();
    const env = getEnv();

    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(4000);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.DUCKDB_PATH).toBe('/tmp/test.duckdb');
    expect(env.CORS_ORIGIN).toBe('https://example.com');
    expect(env.APP_VERSION).toBe('9.9.9');
    expect(env.RATE_LIMIT_MAX).toBe(50);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(5000);
  });
});
