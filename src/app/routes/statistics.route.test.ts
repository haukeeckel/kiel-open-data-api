import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AREAS_SAME_DISTRICTS,
  CATEGORIES_CASES,
  RANKING_CATEGORY_CASES,
  RANKING_UNFILTERED_CASES,
  TIMESERIES_CATEGORY_CASES,
  TIMESERIES_UNFILTERED_CASES,
} from '../../test/fixtures/statisticsRoute.fixtures.js';
import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { type buildServer } from '../server.js';

describe('statistics endpoints', () => {
  const LONG_TEXT = 'x'.repeat(121);
  const LONG_AREA = 'x'.repeat(201);
  let app: Awaited<ReturnType<typeof buildServer>>;
  let dbPath: string;

  beforeAll(async () => {
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

        appInstance.get('/__429', async () => {
          const err = new Error('rate limited');
          Object.assign(err, { statusCode: 429, ttl: 1000 });
          throw err;
        });
      },
    });
    app = res.app;
    dbPath = res.dbPath;
  });

  afterAll(async () => {
    await app.close();
    cleanupDuckDbFiles(dbPath);
  });

  // ---- Error contracts ----

  describe('GET /does-not', () => {
    it('returns 404 for non-existent routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({
        error: { code: 'NOT_FOUND', message: 'Not Found' },
        requestId: expect.any(String),
      });
    });
  });

  it('returns 401 error contract for client errors (does not collapse to 400)', async () => {
    const res = await app.inject({ method: 'GET', url: '/__401' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      error: { code: 'UNAUTHORIZED', message: 'nope' },
      requestId: expect.any(String),
    });
  });

  it('returns 409 error contract for conflict errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/__409' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: { code: 'CONFLICT', message: 'conflict' },
      requestId: expect.any(String),
    });
  });

  it('returns 500 error contract on unhandled error', async () => {
    const res = await app.inject({ method: 'GET', url: '/__boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({
      error: { code: 'INTERNAL', message: 'Internal Server Error' },
      requestId: expect.any(String),
    });
  });

  it('returns 429 error contract for rate limited requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/__429' });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('1');
    expect(res.json()).toMatchObject({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'rate limited',
        details: {
          kind: 'rate_limit',
          retryAfterMs: 1000,
          retryAfterSec: 1,
        },
      },
      requestId: expect.any(String),
    });
  });

  it('adds caching and freshness headers for /v1 responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/areas?indicator=population&areaType=district',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeDefined();
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    expect(res.headers['data-version']).toBeDefined();
    expect(
      res.headers['last-updated-at'] === undefined ||
        typeof res.headers['last-updated-at'] === 'string',
    ).toBe(true);
  });

  it('returns 304 when If-None-Match matches current representation', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/v1/areas?indicator=population&areaType=district',
    });
    expect(first.statusCode).toBe(200);
    const etag = first.headers['etag'];
    expect(etag).toBeDefined();

    const second = await app.inject({
      method: 'GET',
      url: '/v1/areas?indicator=population&areaType=district',
      headers: {
        'if-none-match': String(etag),
      },
    });

    expect(second.statusCode).toBe(304);
    expect(second.body).toBe('');
    expect(second.headers['etag']).toBe(etag);
    expect(second.headers['cache-control']).toBe('public, max-age=60');
    expect(second.headers['data-version']).toBeDefined();
    expect(
      second.headers['last-updated-at'] === undefined ||
        typeof second.headers['last-updated-at'] === 'string',
    ).toBe(true);
  });

  it('uses a different ETag for changed query representations', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/v1/areas?indicator=population&areaType=district',
    });
    const second = await app.inject({
      method: 'GET',
      url: '/v1/areas?indicator=population&areaType=district&like=gaard',
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.headers['etag']).toBeDefined();
    expect(second.headers['etag']).toBeDefined();
    expect(second.headers['etag']).not.toBe(first.headers['etag']);
  });

  it('does not add caching/freshness headers to /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeUndefined();
    expect(res.headers['cache-control']).toBeUndefined();
    expect(res.headers['data-version']).toBeUndefined();
    expect(res.headers['last-updated-at']).toBeUndefined();
  });

  // ---- GET /v1/timeseries ----

  describe('GET /v1/timeseries', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/timeseries' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
        },
        requestId: expect.any(String),
      });
    });

    it('returns 400 for invalid query parameters (zod)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=population&areaType=district&areas=Altstadt&from=abc',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
        },
        requestId: expect.any(String),
      });
    });

    it('returns 400 for overlong area parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/timeseries?indicator=population&areaType=district&areas=${LONG_AREA}`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
        },
        requestId: expect.any(String),
      });
    });

    it('returns 400 when from is greater than to', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=population&areaType=district&areas=Altstadt&from=2024&to=2023',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'from must be <= to',
          reason: 'INVALID_RANGE',
          details: { from: 2024, to: 2023 },
        },
        requestId: expect.any(String),
      });
    });

    it('returns time series for a district', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=population&areaType=district&areas=Altstadt',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'population',
        areaType: 'district',
        areas: ['Altstadt'],
        rows: [
          { area: 'Altstadt', year: 2022, value: 1213, unit: 'persons', category: 'total' },
          { area: 'Altstadt', year: 2023, value: 1220, unit: 'persons', category: 'total' },
        ],
      });
    });

    it('supports from/to filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=population&areaType=district&areas=Altstadt&from=2023&to=2023',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        rows: [{ area: 'Altstadt', year: 2023, value: 1220, unit: 'persons', category: 'total' }],
      });
    });

    it.each(TIMESERIES_UNFILTERED_CASES)(
      'returns unfiltered rows for $indicator when category is omitted',
      async ({ indicator, rows }) => {
        const res = await app.inject({
          method: 'GET',
          url: `/v1/timeseries?indicator=${indicator}&areaType=district&areas=Altstadt`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
          indicator,
          areaType: 'district',
          areas: ['Altstadt'],
          rows,
        });
      },
    );

    it.each(TIMESERIES_CATEGORY_CASES)(
      'returns $indicator rows filtered by category $category',
      async ({ indicator, category, rows }) => {
        const res = await app.inject({
          method: 'GET',
          url: `/v1/timeseries?indicator=${indicator}&areaType=district&areas=Altstadt&categories=${category}`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
          indicator,
          areaType: 'district',
          areas: ['Altstadt'],
          rows,
        });
      },
    );

    it('supports multiple areas and categories via CSV', async () => {
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
          { area: 'Altstadt', year: 2023, value: 582, unit: 'persons', category: 'female' },
          { area: 'Altstadt', year: 2023, value: 638, unit: 'persons', category: 'male' },
          { area: 'Vorstadt', year: 2023, value: 819, unit: 'persons', category: 'female' },
          { area: 'Vorstadt', year: 2023, value: 829, unit: 'persons', category: 'male' },
        ]),
      );
      expect(res.json().rows).toHaveLength(4);
    });

    it('returns 400 for malformed CSV query values', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/timeseries?indicator=gender&areaType=district&areas=Altstadt,,Gaarden-Ost&categories=male,,female',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
        },
      });
    });
  });

  // ---- GET /v1/areas ----

  describe('GET /v1/areas', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/areas' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
        },
        requestId: expect.any(String),
      });
    });

    it('returns 400 for unknown areaType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/areas?indicator=population&areaType=unknown&like=gaard',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Unknown areaType: unknown',
          reason: 'UNKNOWN_AREA_TYPE',
          suggestions: ['district'],
          details: {
            kind: 'domain_validation',
            field: 'areaType',
            value: 'unknown',
            allowed: ['district'],
          },
        },
      });
    });

    it('returns 400 for overlong like parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/areas?indicator=population&areaType=district&like=${LONG_TEXT}`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
        },
      });
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

    it('returns areas across all categories when category is omitted', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/areas?indicator=households&areaType=district',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toEqual(['Altstadt', 'Gaarden-Ost', 'Wik']);
    });

    it.each(AREAS_SAME_DISTRICTS)(
      'returns areas for %s when category is omitted',
      async (indicator) => {
        const res = await app.inject({
          method: 'GET',
          url: `/v1/areas?indicator=${indicator}&areaType=district`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().rows).toEqual(['Altstadt', 'Vorstadt']);
      },
    );
  });

  // ---- GET /v1/categories ----

  describe('GET /v1/categories', () => {
    it.each(CATEGORIES_CASES)('returns categories for $indicator', async ({ indicator, rows }) => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/categories?indicator=${indicator}&areaType=district`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ indicator, areaType: 'district', rows });
    });

    it('returns 400 for unknown indicator', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/categories?indicator=unknown&areaType=district`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Unknown indicator: unknown',
          reason: 'UNKNOWN_INDICATOR',
          suggestions: expect.any(Array),
          details: {
            kind: 'domain_validation',
            field: 'indicator',
            value: 'unknown',
          },
        },
      });
    });

    it('returns 400 for overlong indicator', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/categories?indicator=${LONG_TEXT}&areaType=district`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
        },
      });
    });
  });

  // ---- GET /v1/ranking ----

  describe('GET /v1/ranking', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/ranking' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
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
          reason: 'INVALID_QUERY_PARAMS',
        },
        requestId: expect.any(String),
      });
    });

    it('returns 400 for overlong category parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/ranking?indicator=population&areaType=district&year=2023&categories=${LONG_TEXT}`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
        },
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

    it('returns 400 for unknown category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ranking?indicator=population&areaType=district&year=2023&categories=other',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Unknown category: other',
          reason: 'UNKNOWN_CATEGORY',
          suggestions: expect.any(Array),
          details: {
            kind: 'domain_validation',
            field: 'category',
            value: 'other',
          },
        },
      });
    });

    it.each(RANKING_UNFILTERED_CASES)(
      'returns unfiltered ranking for $indicator when category is omitted (desc)',
      async ({ indicator, year, rows }) => {
        const res = await app.inject({
          method: 'GET',
          url: `/v1/ranking?indicator=${indicator}&areaType=district&year=${year}&limit=2&order=desc`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
          indicator,
          areaType: 'district',
          year,
          order: 'desc',
          limit: 2,
          rows,
        });
      },
    );

    it.each(RANKING_CATEGORY_CASES)(
      'returns ranking for $indicator filtered by category $category',
      async ({ indicator, year, category, rows }) => {
        const res = await app.inject({
          method: 'GET',
          url: `/v1/ranking?indicator=${indicator}&areaType=district&year=${year}&categories=${category}&limit=2&order=desc`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
          indicator,
          areaType: 'district',
          year,
          order: 'desc',
          limit: 2,
          rows,
        });
      },
    );

    it('supports ranking with multiple categories and areas via CSV', async () => {
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

    it('returns 400 for malformed ranking CSV values', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/ranking?indicator=gender&areaType=district&year=2023&areas=Altstadt,,Gaarden-Ost&categories=male,,female',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          reason: 'INVALID_QUERY_PARAMS',
        },
      });
    });
  });

  // ---- GET /v1/indicators ----

  describe('GET /v1/indicators', () => {
    it('returns distinct indicators sorted', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/indicators' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        rows: [
          'age_groups',
          'area_hectares',
          'foreign_age_groups',
          'foreign_count',
          'foreign_gender',
          'foreign_nationalities_selected',
          'gender',
          'households',
          'marital_status',
          'migrant_gender',
          'population',
          'religion',
          'unemployed_count',
          'unemployed_rate',
        ],
      });
    });

    it('filters indicators by areaType', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/indicators?areaType=district' });
      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toContain('population');
      expect(res.json().rows).toContain('gender');
    });

    it('filters indicators by areaType and area', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/indicators?areaType=district&area=Altstadt',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toContain('population');
      expect(res.json().rows).toContain('gender');
    });

    it('filters indicators by year', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/indicators?year=2018' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rows: ['unemployed_rate'] });
    });

    it('filters indicators by area without areaType', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/indicators?area=Wik' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rows: ['households'] });
    });
  });

  // ---- GET /v1/indicators/:indicator ----

  describe('GET /v1/indicators/:indicator', () => {
    it('returns grouped metadata for an indicator', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/indicators/gender' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        indicator: 'gender',
        areaTypes: [
          {
            areaType: 'district',
            years: [2022, 2023],
            categories: ['female', 'male', 'total'],
            areas: ['Altstadt', 'Vorstadt'],
          },
        ],
      });
    });

    it('returns 404 for unknown indicator', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/indicators/unknown' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({
        error: { code: 'NOT_FOUND', message: 'Indicator not found: unknown' },
        requestId: expect.any(String),
      });
    });
  });

  // ---- GET /v1/years ----

  describe('GET /v1/years', () => {
    it('returns years without filters', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/years' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rows: [2018, 2019, 2020, 2022, 2023] });
    });

    it('filters years by indicator and areaType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/years?indicator=gender&areaType=district',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rows: [2022, 2023] });
    });

    it('filters years by category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/years?indicator=gender&areaType=district&category=single_person',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rows: [] });
    });

    it('filters years by area', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/years?area=Wik',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rows: [2023] });
    });

    it('returns empty rows for unknown indicator context', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/years?indicator=unknown',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rows: [] });
    });

    it('returns 400 for unknown areaType filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/years?areaType=unknown',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Unknown areaType: unknown',
          reason: 'UNKNOWN_AREA_TYPE',
          suggestions: ['district'],
        },
      });
    });
  });

  // ---- GET /v1/years/:year ----

  describe('GET /v1/years/:year', () => {
    it('returns grouped metadata for a year', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/years/2023' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        year: 2023,
        areaTypes: [
          {
            areaType: 'district',
            indicators: [
              'age_groups',
              'foreign_age_groups',
              'foreign_count',
              'foreign_gender',
              'foreign_nationalities_selected',
              'gender',
              'households',
              'marital_status',
              'migrant_gender',
              'population',
              'religion',
              'unemployed_count',
            ],
            categories: expect.any(Array),
            areas: ['Altstadt', 'Gaarden-Ost', 'Schreventeich', 'Vorstadt', 'Wik'],
          },
        ],
      });
      expect((res.json().areaTypes[0] as { categories: string[] }).categories).toContain('total');
      expect((res.json().areaTypes[0] as { categories: string[] }).categories).toContain('male');
    });

    it('returns 404 for unknown year', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/years/1999' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({
        error: { code: 'NOT_FOUND', message: 'Year not found: 1999' },
        requestId: expect.any(String),
      });
    });
  });

  // ---- GET /v1/area-types ----

  describe('GET /v1/area-types', () => {
    it('returns distinct area types sorted', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/area-types' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rows: ['district'] });
    });
  });
});
