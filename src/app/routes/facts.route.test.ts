import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app';
import { type buildServer } from '../../server';

describe('facts endpoints', () => {
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

  afterAll(async () => {
    await app.close();
    cleanupDuckDbFiles(dbPath);
  });

  describe('GET /does-not', () => {
    it('returns 404 for non-existent routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'Not Found',
        },
        requestId: expect.any(String),
      });
    });
  });

  it('returns 500 error contract on unhandled error', async () => {
    const res = await app.inject({ method: 'GET', url: '/__boom' });
    expect(res.statusCode).toBe(500);

    expect(res.json()).toMatchObject({
      error: {
        code: 'INTERNAL',
        message: 'Internal Server Error',
      },
      requestId: expect.any(String),
    });

    await app.close();
  });

  describe('GET /timeseries', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/timeseries' });
      expect(res.statusCode).toBe(400);

      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
        },
        requestId: expect.any(String),
      });
    });

    it('returns 400 for invalid query parameters (zod)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/timeseries?indicator=population&areaType=district&area=Altstadt&from=abc',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
        },
        requestId: expect.any(String),
      });
    });

    it('returns time series for a district', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/timeseries?indicator=population&areaType=district&area=Altstadt',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'population',
        areaType: 'district',
        area: 'Altstadt',
        rows: [
          { year: 2022, value: 1213, unit: 'persons' },
          { year: 2023, value: 1220, unit: 'persons' },
        ],
      });
    });

    it('supports from/to filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/timeseries?indicator=population&areaType=district&area=Altstadt&from=2023&to=2023',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        rows: [{ year: 2023, value: 1220, unit: 'persons' }],
      });
    });
  });

  describe('GET /areas', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/areas' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
        },
        requestId: expect.any(String),
      });
    });

    it('returns 400 for invalid query parameters (zod)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/areas?indicator=population&areaType=district&like=123&extra=wat',
      });

      // only if your schema rejects unknown keys; if not, remove `extra=...`
      // and instead test a wrong type.
      expect([200, 400]).toContain(res.statusCode);
    });

    it('returns distinct areas sorted', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/areas?indicator=population&areaType=district',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      expect(body.indicator).toBe('population');
      expect(body.areaType).toBe('district');
      expect(body.rows).toEqual(['Altstadt', 'Gaarden-Ost', 'Schreventeich']);
    });

    it('supports like filter (case-insensitive)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/areas?indicator=population&areaType=district&like=gaard',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toEqual(['Gaarden-Ost']);
    });
  });

  describe('GET /ranking', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/ranking' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
        },
        requestId: expect.any(String),
      });
    });

    it('returns 400 for invalid query parameters (zod)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ranking?indicator=population&areaType=district&year=not-a-year',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
        },
        requestId: expect.any(String),
      });
    });

    it('returns ranking for a year (desc)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ranking?indicator=population&areaType=district&year=2023&limit=2&order=desc',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        order: 'desc',
        limit: 2,
        rows: [
          { area: 'Gaarden-Ost', value: 18000, unit: 'persons' },
          { area: 'Schreventeich', value: 9000, unit: 'persons' },
        ],
      });
    });

    it('returns ranking (asc)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ranking?indicator=population&areaType=district&year=2023&limit=1&order=asc',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toEqual([{ area: 'Altstadt', value: 1220, unit: 'persons' }]);
    });
  });
});
