import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { makeEnv } from '../../test/helpers/makeEnv.js';

import corsPlugin from './cors.js';

describe('cors', () => {
  it('sets access-control-allow-origin on GET responses', async () => {
    const app = Fastify();
    await app.register(corsPlugin, { env: makeEnv({ CORS_ORIGIN: '*' }) });
    app.get('/health', async () => ({ ok: true }));

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    await app.close();
  });

  it('handles OPTIONS preflight requests', async () => {
    const app = Fastify();
    await app.register(corsPlugin, { env: makeEnv({ CORS_ORIGIN: '*' }) });
    app.get('/health', async () => ({ ok: true }));

    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    await app.close();
  });
});
