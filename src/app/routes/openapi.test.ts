import { describe, expect, it } from 'vitest';
import { buildServer } from '../../server';

describe('openapi', () => {
  it('GET /docs/json returns an OpenAPI document', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DUCKDB_PATH = 'data/cache/test.duckdb';

    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(res.statusCode).toBe(200);

    const body = res.json();

    // minimal assertions (nicht zu brittle)
    expect(body).toMatchObject({
      openapi: expect.any(String),
      info: {
        title: 'kiel-dashboard-api',
      },
      paths: expect.any(Object),
    });

    // sanity: the routes we care about exist in the spec
    expect(body.paths).toHaveProperty('/health');
    expect(body.paths).toHaveProperty('/timeseries');
    expect(body.paths).toHaveProperty('/areas');
    expect(body.paths).toHaveProperty('/ranking');

    await app.close();
  });
});
