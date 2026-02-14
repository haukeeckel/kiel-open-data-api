import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { type buildServer } from '../server.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TIMESERIES_UNFILTERED_CASES = [
  {
    indicator: 'population',
    rows: [
      { year: 2022, value: 1213, unit: 'persons', category: 'total' },
      { year: 2023, value: 1220, unit: 'persons', category: 'total' },
    ],
  },
  {
    indicator: 'households',
    rows: [
      { year: 2023, value: 810, unit: 'households', category: 'total' },
      { year: 2023, value: 505, unit: 'households', category: 'single_person' },
    ],
  },
  {
    indicator: 'area_hectares',
    rows: [
      { year: 2019, value: 35.0987, unit: 'hectares', category: 'total' },
      { year: 2020, value: 35.0987, unit: 'hectares', category: 'total' },
    ],
  },
  {
    indicator: 'unemployed_count',
    rows: [
      { year: 2022, value: 14, unit: 'persons', category: 'total' },
      { year: 2023, value: 16, unit: 'persons', category: 'total' },
    ],
  },
  {
    indicator: 'unemployed_rate',
    rows: [
      { year: 2018, value: 2.3, unit: 'percent', category: 'total' },
      { year: 2019, value: 1.6, unit: 'percent', category: 'total' },
    ],
  },
  {
    indicator: 'foreign_count',
    rows: [
      { year: 2022, value: 214, unit: 'persons', category: 'total' },
      { year: 2023, value: 212, unit: 'persons', category: 'total' },
    ],
  },
];

const TIMESERIES_CATEGORY_CASES = [
  {
    indicator: 'households',
    category: 'single_person',
    rows: [{ year: 2023, value: 505, unit: 'households', category: 'single_person' }],
  },
  {
    indicator: 'gender',
    category: 'male',
    rows: [{ year: 2023, value: 638, unit: 'persons', category: 'male' }],
  },
  {
    indicator: 'age_groups',
    category: 'age_0_2',
    rows: [{ year: 2023, value: 19, unit: 'persons', category: 'age_0_2' }],
  },
  {
    indicator: 'religion',
    category: 'evangelical',
    rows: [{ year: 2023, value: 344, unit: 'persons', category: 'evangelical' }],
  },
  {
    indicator: 'foreign_nationalities_selected',
    category: 'turkey',
    rows: [{ year: 2023, value: 8, unit: 'persons', category: 'turkey' }],
  },
  {
    indicator: 'foreign_age_groups',
    category: 'age_0_2',
    rows: [{ year: 2023, value: 4, unit: 'persons', category: 'age_0_2' }],
  },
  {
    indicator: 'foreign_gender',
    category: 'male',
    rows: [{ year: 2023, value: 127, unit: 'persons', category: 'male' }],
  },
  {
    indicator: 'migrant_gender',
    category: 'male',
    rows: [{ year: 2023, value: 199, unit: 'persons', category: 'male' }],
  },
];

const AREAS_SAME_DISTRICTS = [
  'marital_status',
  'gender',
  'age_groups',
  'area_hectares',
  'unemployed_count',
  'unemployed_rate',
  'religion',
  'foreign_nationalities_selected',
  'foreign_age_groups',
  'foreign_gender',
  'foreign_count',
  'migrant_gender',
];

const CATEGORIES_CASES = [
  { indicator: 'households', rows: ['single_person', 'total'] },
  { indicator: 'marital_status', rows: ['divorced', 'married', 'single', 'total', 'widowed'] },
  { indicator: 'gender', rows: ['female', 'male', 'total'] },
  {
    indicator: 'age_groups',
    rows: [
      'age_0_2',
      'age_10_11',
      'age_12_14',
      'age_15_17',
      'age_18_20',
      'age_21_24',
      'age_25_29',
      'age_30_34',
      'age_35_39',
      'age_3_5',
      'age_40_44',
      'age_45_49',
      'age_50_54',
      'age_55_59',
      'age_60_64',
      'age_65_69',
      'age_6_9',
      'age_70_74',
      'age_75_79',
      'age_80_plus',
      'total',
    ],
  },
  { indicator: 'area_hectares', rows: ['total'] },
  { indicator: 'unemployed_count', rows: ['total'] },
  { indicator: 'unemployed_rate', rows: ['total'] },
  { indicator: 'religion', rows: ['catholic', 'evangelical', 'other_or_none', 'total'] },
  {
    indicator: 'foreign_nationalities_selected',
    rows: ['bulgaria', 'iraq', 'poland', 'russia', 'syria', 'total', 'turkey', 'ukraine'],
  },
  {
    indicator: 'foreign_age_groups',
    rows: [
      'age_0_2',
      'age_10_11',
      'age_12_14',
      'age_15_17',
      'age_18_20',
      'age_21_24',
      'age_25_29',
      'age_30_34',
      'age_35_39',
      'age_3_5',
      'age_40_44',
      'age_45_49',
      'age_50_54',
      'age_55_59',
      'age_60_64',
      'age_65_69',
      'age_6_9',
      'age_70_74',
      'age_75_79',
      'age_80_plus',
      'total',
    ],
  },
  { indicator: 'foreign_gender', rows: ['female', 'male', 'total'] },
  { indicator: 'foreign_count', rows: ['total'] },
  { indicator: 'migrant_gender', rows: ['female', 'male', 'total'] },
];

const RANKING_UNFILTERED_CASES = [
  {
    indicator: 'population',
    year: 2023,
    rows: [
      { area: 'Gaarden-Ost', value: 18000, unit: 'persons', category: 'total' },
      { area: 'Schreventeich', value: 9000, unit: 'persons', category: 'total' },
    ],
  },
  {
    indicator: 'households',
    year: 2023,
    rows: [
      { area: 'Gaarden-Ost', value: 6050, unit: 'households', category: 'total' },
      { area: 'Gaarden-Ost', value: 3220, unit: 'households', category: 'single_person' },
    ],
  },
  {
    indicator: 'area_hectares',
    year: 2020,
    rows: [
      { area: 'Vorstadt', value: 45.8515, unit: 'hectares', category: 'total' },
      { area: 'Altstadt', value: 35.0987, unit: 'hectares', category: 'total' },
    ],
  },
  {
    indicator: 'unemployed_count',
    year: 2023,
    rows: [
      { area: 'Vorstadt', value: 43, unit: 'persons', category: 'total' },
      { area: 'Altstadt', value: 16, unit: 'persons', category: 'total' },
    ],
  },
  {
    indicator: 'unemployed_rate',
    year: 2019,
    rows: [
      { area: 'Vorstadt', value: 4.2, unit: 'percent', category: 'total' },
      { area: 'Altstadt', value: 1.6, unit: 'percent', category: 'total' },
    ],
  },
  {
    indicator: 'foreign_count',
    year: 2023,
    rows: [
      { area: 'Vorstadt', value: 324, unit: 'persons', category: 'total' },
      { area: 'Altstadt', value: 212, unit: 'persons', category: 'total' },
    ],
  },
];

const RANKING_CATEGORY_CASES = [
  {
    indicator: 'gender',
    year: 2023,
    category: 'male',
    rows: [
      { area: 'Vorstadt', value: 829, unit: 'persons', category: 'male' },
      { area: 'Altstadt', value: 638, unit: 'persons', category: 'male' },
    ],
  },
  {
    indicator: 'age_groups',
    year: 2023,
    category: 'age_80_plus',
    rows: [
      { area: 'Altstadt', value: 153, unit: 'persons', category: 'age_80_plus' },
      { area: 'Vorstadt', value: 115, unit: 'persons', category: 'age_80_plus' },
    ],
  },
  {
    indicator: 'foreign_nationalities_selected',
    year: 2023,
    category: 'ukraine',
    rows: [
      { area: 'Altstadt', value: 21, unit: 'persons', category: 'ukraine' },
      { area: 'Vorstadt', value: 16, unit: 'persons', category: 'ukraine' },
    ],
  },
  {
    indicator: 'foreign_age_groups',
    year: 2023,
    category: 'age_80_plus',
    rows: [
      { area: 'Vorstadt', value: 7, unit: 'persons', category: 'age_80_plus' },
      { area: 'Altstadt', value: 3, unit: 'persons', category: 'age_80_plus' },
    ],
  },
  {
    indicator: 'foreign_gender',
    year: 2023,
    category: 'female',
    rows: [
      { area: 'Vorstadt', value: 164, unit: 'persons', category: 'female' },
      { area: 'Altstadt', value: 85, unit: 'persons', category: 'female' },
    ],
  },
  {
    indicator: 'migrant_gender',
    year: 2023,
    category: 'female',
    rows: [
      { area: 'Vorstadt', value: 265, unit: 'persons', category: 'female' },
      { area: 'Altstadt', value: 165, unit: 'persons', category: 'female' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('statistics endpoints', () => {
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
    expect(res.json()).toMatchObject({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'rate limited',
        details: {
          kind: 'rate_limit',
          retryAfterMs: 1000,
        },
      },
      requestId: expect.any(String),
    });
  });

  // ---- GET /v1/timeseries ----

  describe('GET /v1/timeseries', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/timeseries' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: { code: 'BAD_REQUEST', message: 'Invalid query parameters' },
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
        error: { code: 'BAD_REQUEST', message: 'Invalid query parameters' },
        requestId: expect.any(String),
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

    it.each(TIMESERIES_UNFILTERED_CASES)(
      'returns unfiltered rows for $indicator when category is omitted',
      async ({ indicator, rows }) => {
        const res = await app.inject({
          method: 'GET',
          url: `/v1/timeseries?indicator=${indicator}&areaType=district&area=Altstadt`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
          indicator,
          areaType: 'district',
          area: 'Altstadt',
          rows,
        });
      },
    );

    it.each(TIMESERIES_CATEGORY_CASES)(
      'returns $indicator rows filtered by category $category',
      async ({ indicator, category, rows }) => {
        const res = await app.inject({
          method: 'GET',
          url: `/v1/timeseries?indicator=${indicator}&areaType=district&area=Altstadt&category=${category}`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
          indicator,
          areaType: 'district',
          area: 'Altstadt',
          rows,
        });
      },
    );
  });

  // ---- GET /v1/areas ----

  describe('GET /v1/areas', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/areas' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: { code: 'BAD_REQUEST', message: 'Invalid query parameters' },
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
          details: {
            kind: 'domain_validation',
            field: 'areaType',
            value: 'unknown',
            allowed: ['district'],
          },
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
          details: {
            kind: 'domain_validation',
            field: 'indicator',
            value: 'unknown',
          },
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
        error: { code: 'BAD_REQUEST', message: 'Invalid query parameters' },
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
        error: { code: 'BAD_REQUEST', message: 'Invalid query parameters' },
        requestId: expect.any(String),
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
        url: '/v1/ranking?indicator=population&areaType=district&year=2023&category=other',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Unknown category: other',
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
          url: `/v1/ranking?indicator=${indicator}&areaType=district&year=${year}&category=${category}&limit=2&order=desc`,
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
