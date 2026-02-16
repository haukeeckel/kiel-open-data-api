import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { type buildServer } from '../server.js';

describe('httpCache plugin', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let dbPath: string;

  beforeAll(async () => {
    const res = await makeAppAndSeed();
    app = res.app;
    dbPath = res.dbPath;
  });

  afterAll(async () => {
    await app.close();
    cleanupDuckDbFiles(dbPath);
  });

  it('returns 304 when If-None-Match includes a weak ETag token', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/v1/areas?indicator=population&areaType=district',
    });
    expect(first.statusCode).toBe(200);
    const etag = String(first.headers['etag']);

    const second = await app.inject({
      method: 'GET',
      url: '/v1/areas?indicator=population&areaType=district',
      headers: {
        'if-none-match': `W/${etag}`,
      },
    });

    expect(second.statusCode).toBe(304);
    expect(second.body).toBe('');
  });

  it('returns 304 when one token in If-None-Match list matches', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/v1/categories?indicator=gender&areaType=district',
    });
    expect(first.statusCode).toBe(200);
    const etag = String(first.headers['etag']);

    const second = await app.inject({
      method: 'GET',
      url: '/v1/categories?indicator=gender&areaType=district',
      headers: {
        'if-none-match': `"nope", ${etag}, "other"`,
      },
    });

    expect(second.statusCode).toBe(304);
    expect(second.body).toBe('');
  });

  it('does not apply conditional caching to non-/v1 routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeUndefined();
    expect(res.headers['data-version']).toBeUndefined();
    expect(res.headers['last-updated-at']).toBeUndefined();
  });
});
