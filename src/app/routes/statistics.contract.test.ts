import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { type buildServer } from '../server.js';

describe('statistics contract', () => {
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

  it('keeps /v1/timeseries contract stable for plural CSV params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/timeseries?indicator=gender&areaType=district&areas=Altstadt,Vorstadt&categories=male,female',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      indicator: 'gender',
      areaType: 'district',
      areas: ['Altstadt', 'Vorstadt'],
    });
    expect(res.json().rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: 'Altstadt', category: 'male' }),
        expect.objectContaining({ area: 'Altstadt', category: 'female' }),
        expect.objectContaining({ area: 'Vorstadt', category: 'male' }),
        expect.objectContaining({ area: 'Vorstadt', category: 'female' }),
      ]),
    );
  });

  it('keeps /v1/ranking contract stable for plural CSV params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/ranking?indicator=gender&areaType=district&year=2023&areas=Altstadt,Vorstadt&categories=male,female&limit=10&order=desc',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      indicator: 'gender',
      areaType: 'district',
      year: 2023,
      order: 'desc',
      limit: 10,
    });
    expect(res.json().rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: 'Altstadt', category: 'male' }),
        expect.objectContaining({ area: 'Altstadt', category: 'female' }),
        expect.objectContaining({ area: 'Vorstadt', category: 'male' }),
        expect.objectContaining({ area: 'Vorstadt', category: 'female' }),
      ]),
    );
  });

  it('keeps 400 validation error contract stable', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/timeseries?indicator=population&areaType=district',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: expect.any(String),
      },
      requestId: expect.any(String),
    });
  });
});
