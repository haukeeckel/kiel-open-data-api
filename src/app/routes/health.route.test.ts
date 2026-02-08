import { describe, expect, it } from 'vitest';
import { buildServer } from '../server';

describe('api smoke', () => {
  it('GET /health returns ok', async () => {
    process.env.DUCKDB_PATH = 'data/cache/test.duckdb';
    process.env.NODE_ENV = 'test';

    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });

    await app.close();
  });

  it('GET / returns endpoint list', async () => {
    process.env.DUCKDB_PATH = 'data/cache/test.duckdb';
    process.env.NODE_ENV = 'test';

    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'kiel-dashboard-api' });

    await app.close();
  });
});
