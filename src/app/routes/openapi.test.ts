import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_NAME } from '../../config/constants.js';
import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { type buildServer } from '../server.js';

describe('openapi', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let dbPath: string;

  beforeEach(async () => {
    const res = await makeAppAndSeed();
    app = res.app;
    dbPath = res.dbPath;
  });

  afterEach(async () => {
    await app.close();
    cleanupDuckDbFiles(dbPath);
  });

  it('GET /docs/json returns an OpenAPI document', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(res.statusCode).toBe(200);

    const body = res.json();

    // minimal assertions (avoid brittleness)
    expect(body).toMatchObject({
      openapi: expect.any(String),
      info: {
        title: API_NAME,
      },
      paths: expect.any(Object),
    });

    // sanity: the routes we care about exist in the spec
    expect(body.paths).toHaveProperty('/health');
    expect(body.paths).toHaveProperty('/v1/timeseries');
    expect(body.paths).toHaveProperty('/v1/areas');
    expect(body.paths).toHaveProperty('/v1/ranking');
  });
});
