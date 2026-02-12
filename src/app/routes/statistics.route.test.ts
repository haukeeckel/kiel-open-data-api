import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { type buildServer } from '../server.js';

describe('statistics endpoints', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let dbPath: string;

  beforeEach(async () => {
    const res = await makeAppAndSeed({
      registerRoutes: (appInstance) => {
        appInstance.get('/__boom', async () => {
          throw new Error('boom');
        });

        appInstance.get('/__401', async () => {
          const err = new Error('nope');
          Object.assign(err, { statusCode: 401 });
          throw err;
        });

        appInstance.get('/__409', async () => {
          const err = new Error('conflict');
          Object.assign(err, { statusCode: 409 });
          throw err;
        });
      },
    });
    app = res.app;
    dbPath = res.dbPath;
  });

  afterEach(async () => {
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

  it('returns 401 error contract for client errors (does not collapse to 400)', async () => {
    const res = await app.inject({ method: 'GET', url: '/__401' });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
        message: 'nope',
      },
      requestId: expect.any(String),
    });
  });

  it('returns 409 error contract for conflict errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/__409' });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        message: 'conflict',
      },
      requestId: expect.any(String),
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
  });

  describe('GET /v1/timeseries', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/timeseries' });
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
        url: '/v1/timeseries?indicator=population&areaType=district&area=Altstadt&from=abc',
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
        url: '/v1/timeseries?indicator=population&areaType=district&area=Altstadt',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'population',
        areaType: 'district',
        area: 'Altstadt',
        rows: [
          { year: 2022, value: 1213, unit: 'persons', category: 'total' },
          { year: 2023, value: 1220, unit: 'persons', category: 'total' },
        ],
      });
    });

    it('supports from/to filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=population&areaType=district&area=Altstadt&from=2023&to=2023',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        rows: [{ year: 2023, value: 1220, unit: 'persons', category: 'total' }],
      });
    });

    it('supports category filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=households&areaType=district&area=Altstadt&category=single_person',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'households',
        areaType: 'district',
        area: 'Altstadt',
        rows: [{ year: 2023, value: 505, unit: 'households', category: 'single_person' }],
      });
    });

    it('supports marital status indicator with default total category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=marital_status&areaType=district&area=Altstadt',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'marital_status',
        areaType: 'district',
        area: 'Altstadt',
        rows: [
          { year: 2022, value: 1183, unit: 'persons', category: 'total' },
          { year: 2023, value: 1220, unit: 'persons', category: 'total' },
        ],
      });
    });

    it('supports gender indicator with default total category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=gender&areaType=district&area=Altstadt',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'gender',
        areaType: 'district',
        area: 'Altstadt',
        rows: [
          { year: 2022, value: 1213, unit: 'persons', category: 'total' },
          { year: 2023, value: 1220, unit: 'persons', category: 'total' },
        ],
      });
    });

    it('supports gender indicator with explicit category filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=gender&areaType=district&area=Altstadt&category=male',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'gender',
        areaType: 'district',
        area: 'Altstadt',
        rows: [{ year: 2023, value: 638, unit: 'persons', category: 'male' }],
      });
    });

    it('returns 400 when from is greater than to', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=population&areaType=district&area=Altstadt&from=2024&to=2023',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'from must be <= to',
          details: { from: 2024, to: 2023 },
        },
        requestId: expect.any(String),
      });
    });
  });

  describe('GET /v1/areas', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/areas' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
        },
        requestId: expect.any(String),
      });
    });

    it('returns empty rows for unknown areaType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/areas?indicator=population&areaType=unknown&like=gaard',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ rows: [] });
    });

    it('returns distinct areas sorted', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/areas?indicator=population&areaType=district',
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
        url: '/v1/areas?indicator=population&areaType=district&like=gaard',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toEqual(['Gaarden-Ost']);
    });

    it('supports indicator with default total category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/areas?indicator=households&areaType=district',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toEqual(['Altstadt', 'Gaarden-Ost']);
    });

    it('supports marital status indicator with default total category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/areas?indicator=marital_status&areaType=district',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toEqual(['Altstadt', 'Vorstadt']);
    });

    it('supports gender indicator with default total category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/areas?indicator=gender&areaType=district',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toEqual(['Altstadt', 'Vorstadt']);
    });
  });

  describe('GET /v1/categories', () => {
    it('returns distinct categories for indicator and areaType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/categories?indicator=households&areaType=district',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'households',
        areaType: 'district',
        rows: ['single_person', 'total'],
      });
    });

    it('returns distinct marital status categories for indicator and areaType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/categories?indicator=marital_status&areaType=district',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'marital_status',
        areaType: 'district',
        rows: ['divorced', 'married', 'single', 'total', 'widowed'],
      });
    });

    it('returns distinct gender categories for indicator and areaType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/categories?indicator=gender&areaType=district',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'gender',
        areaType: 'district',
        rows: ['female', 'male', 'total'],
      });
    });
  });

  describe('GET /v1/ranking', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/ranking' });
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
        url: '/v1/ranking?indicator=population&areaType=district&year=not-a-year',
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
        url: '/v1/ranking?indicator=population&areaType=district&year=2023&limit=2&order=desc',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        order: 'desc',
        limit: 2,
        rows: [
          { area: 'Gaarden-Ost', value: 18000, unit: 'persons', category: 'total' },
          { area: 'Schreventeich', value: 9000, unit: 'persons', category: 'total' },
        ],
      });
    });

    it('returns ranking (asc)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ranking?indicator=population&areaType=district&year=2023&limit=1&order=asc',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toEqual([
        { area: 'Altstadt', value: 1220, unit: 'persons', category: 'total' },
      ]);
    });

    it('returns ranking for marital status indicator with default total category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ranking?indicator=marital_status&areaType=district&year=2023&limit=2&order=desc',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'marital_status',
        areaType: 'district',
        year: 2023,
        order: 'desc',
        limit: 2,
        rows: [
          { area: 'Vorstadt', value: 1648, unit: 'persons', category: 'total' },
          { area: 'Altstadt', value: 1220, unit: 'persons', category: 'total' },
        ],
      });
    });

    it('returns ranking for gender indicator with default total category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ranking?indicator=gender&areaType=district&year=2023&limit=2&order=desc',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'gender',
        areaType: 'district',
        year: 2023,
        order: 'desc',
        limit: 2,
        rows: [
          { area: 'Vorstadt', value: 1648, unit: 'persons', category: 'total' },
          { area: 'Altstadt', value: 1220, unit: 'persons', category: 'total' },
        ],
      });
    });

    it('returns ranking for gender indicator with explicit category filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ranking?indicator=gender&areaType=district&year=2023&category=male&limit=2&order=desc',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'gender',
        areaType: 'district',
        year: 2023,
        order: 'desc',
        limit: 2,
        rows: [
          { area: 'Vorstadt', value: 829, unit: 'persons', category: 'male' },
          { area: 'Altstadt', value: 638, unit: 'persons', category: 'male' },
        ],
      });
    });
  });

  describe('GET /v1/indicators', () => {
    it('returns distinct indicators sorted', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/indicators' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        rows: ['gender', 'households', 'marital_status', 'population'],
      });
    });
  });

  describe('GET /v1/area-types', () => {
    it('returns distinct area types sorted', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/area-types' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        rows: ['district'],
      });
    });
  });
});
