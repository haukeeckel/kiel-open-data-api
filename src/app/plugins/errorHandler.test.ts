import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { StatisticsNotFoundError } from '../../domains/statistics/errors/statisticsNotFoundError.js';
import { StatisticsValidationError } from '../../domains/statistics/errors/statisticsValidationError.js';

import errorHandlerPlugin from './errorHandler.js';

describe('errorHandler plugin', () => {
  it('maps domain validation error to 400', async () => {
    const app = Fastify();
    await app.register(errorHandlerPlugin);

    app.get('/domain', async () => {
      throw new StatisticsValidationError('bad', { foo: 'bar' });
    });

    const res = await app.inject({ method: 'GET', url: '/domain' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'bad',
        reason: 'INVALID_QUERY_PARAMS',
        details: { foo: 'bar' },
      },
      requestId: expect.any(String),
    });
  });

  it('maps unknown domain values to specific reason with suggestions', async () => {
    const app = Fastify();
    await app.register(errorHandlerPlugin);

    app.get('/domain-unknown', async () => {
      throw new StatisticsValidationError('Unknown indicator: unknown', {
        kind: 'domain_validation',
        field: 'indicator',
        value: 'unknown',
        allowed: ['population', 'gender', 'households'],
      });
    });

    const res = await app.inject({ method: 'GET', url: '/domain-unknown' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'Unknown indicator: unknown',
        reason: 'UNKNOWN_INDICATOR',
        suggestions: ['population', 'gender', 'households'],
      },
      requestId: expect.any(String),
    });
  });

  it('maps domain not found error to 404', async () => {
    const app = Fastify();
    await app.register(errorHandlerPlugin);

    app.get('/domain-not-found', async () => {
      throw new StatisticsNotFoundError('indicator missing');
    });

    const res = await app.inject({ method: 'GET', url: '/domain-not-found' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: 'indicator missing',
      },
      requestId: expect.any(String),
    });
  });

  it('maps fastify validation error to 400 with standard message', async () => {
    const app = Fastify();
    await app.register(errorHandlerPlugin);

    app.get('/validation', async () => {
      const err = new Error('invalid');
      (err as { statusCode?: number }).statusCode = 400;
      (err as { validation?: unknown }).validation = [{ message: 'nope' }];
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/validation' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid query parameters',
        reason: 'INVALID_QUERY_PARAMS',
      },
      requestId: expect.any(String),
    });
  });

  it('maps client errors preserving status code', async () => {
    const app = Fastify();
    await app.register(errorHandlerPlugin);

    app.get('/unauthorized', async () => {
      const err = new Error('nope');
      (err as { statusCode?: number }).statusCode = 401;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/unauthorized' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
        message: 'nope',
      },
      requestId: expect.any(String),
    });
  });

  it('maps rate limit errors to 429 with typed code', async () => {
    const app = Fastify();
    await app.register(errorHandlerPlugin);

    app.get('/rate-limit', async () => {
      const err = new Error('Rate limit exceeded');
      (err as { statusCode?: number }).statusCode = 429;
      (err as { ttl?: number }).ttl = 1000;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/rate-limit' });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('1');
    expect(res.json()).toMatchObject({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
        details: {
          kind: 'rate_limit',
          retryAfterMs: 1000,
          retryAfterSec: 1,
        },
      },
      requestId: expect.any(String),
    });
  });

  it('maps unhandled errors to 500', async () => {
    const app = Fastify();
    await app.register(errorHandlerPlugin);

    app.get('/boom', async () => {
      throw new Error('boom');
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({
      error: {
        code: 'INTERNAL',
        message: 'Internal Server Error',
      },
      requestId: expect.any(String),
    });
  });
});
