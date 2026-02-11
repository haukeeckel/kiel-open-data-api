import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

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
        details: { foo: 'bar' },
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
