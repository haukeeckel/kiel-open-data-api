import { describe, expect, it } from 'vitest';
import { buildServer } from './server';

describe('api smoke', () => {
  it('GET /health returns ok', async () => {
    const app = buildServer();

    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toMatchObject({ ok: true });
    expect(typeof body.ts).toBe('string');

    await app.close();
  });

  it('GET / returns endpoint list', async () => {
    const app = buildServer();

    const res = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      name: 'kiel-dashboard-api',
    });

    await app.close();
  });

  it('GET /db-test returns 42', async () => {
    const app = buildServer();

    const res = await app.inject({ method: 'GET', url: '/db-test' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ rows: [{ answer: 42 }] });

    await app.close();
  });
});
