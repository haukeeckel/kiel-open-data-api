import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { withTestEnv } from '../../test/helpers/env.js';

import rateLimitPlugin from './rateLimit.js';

describe('rateLimit plugin', () => {
  it('skips rate limiting in test env', async () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'test',
      RATE_LIMIT_MAX: 1,
      RATE_LIMIT_WINDOW_MS: 1000,
    });

    try {
      const app = Fastify();
      await app.register(rateLimitPlugin);
      app.get('/', async () => ({ ok: true }));

      const r1 = await app.inject({ method: 'GET', url: '/' });
      const r2 = await app.inject({ method: 'GET', url: '/' });

      expect(r1.statusCode).toBe(200);
      expect(r2.statusCode).toBe(200);
    } finally {
      restoreEnv();
    }
  });

  it('limits requests in production', async () => {
    const restoreEnv = withTestEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      RATE_LIMIT_MAX: 1,
      RATE_LIMIT_WINDOW_MS: 1000,
    });

    try {
      const app = Fastify();
      await app.register(rateLimitPlugin);
      app.get('/', async () => ({ ok: true }));

      const r1 = await app.inject({ method: 'GET', url: '/' });
      const r2 = await app.inject({ method: 'GET', url: '/' });

      expect(r1.statusCode).toBe(200);
      expect(r2.statusCode).toBe(429);
    } finally {
      restoreEnv();
    }
  });
});
