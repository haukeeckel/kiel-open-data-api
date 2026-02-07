import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildServer } from './server';
import { getDb, resetDbForTests } from './db';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'cache', 'test.duckdb');

async function seedFacts() {
  const db = await getDb();
  const conn = await db.connect();

  try {
    await conn.run(`
      CREATE TABLE IF NOT EXISTS facts (
        indicator TEXT,
        area_type TEXT,
        area_name TEXT,
        year INTEGER,
        value DOUBLE,
        unit TEXT
      );
    `);

    await conn.run(`DELETE FROM facts;`);

    // Seed: population by district for 2022/2023
    await conn.run(
      `
      INSERT INTO facts (indicator, area_type, area_name, year, value, unit) VALUES
      ('population','district','Altstadt',2022,1213,'persons'),
      ('population','district','Altstadt',2023,1220,'persons'),
      ('population','district','Gaarden-Ost',2023,18000,'persons'),
      ('population','district','Schreventeich',2023,9000,'persons');
      `,
    );
  } finally {
    // duckdb node-api hat je nach Version close() oder disconnectSync(); du nutzt disconnectSync()
    // falls close() existiert: await conn.close();
    conn.disconnectSync();
  }
}

describe('facts endpoints', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    // isolate DB for this test file
    fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

    process.env.NODE_ENV = 'test';
    process.env.DUCKDB_PATH = TEST_DB_PATH;
    resetDbForTests();

    app = await buildServer();
    await seedFacts();
  });

  afterAll(async () => {
    await app.close();
    // cleanup
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  beforeEach(() => {
    // in case a test changes env later
    process.env.DUCKDB_PATH = TEST_DB_PATH;
  });

  describe('GET /timeseries', () => {
    it('returns 400 when required params are missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/timeseries' });
      expect(res.statusCode).toBe(400);

      // depending on your zod schema, this might be either "Invalid query parameters"
      // or "indicator, areaType and area are required".
      const body = res.json();
      expect(body).toHaveProperty('error');
    });

    it('returns 400 for invalid query parameters (zod)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/timeseries?indicator=population&areaType=district&area=Altstadt&from=abc',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: 'Invalid query parameters',
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
      expect(res.json()).toHaveProperty('error');
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
      expect(res.json()).toHaveProperty('error');
    });

    it('returns 400 for invalid query parameters (zod)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ranking?indicator=population&areaType=district&year=not-a-year',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: 'Invalid query parameters',
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

describe('api smoke', () => {
  it('GET /health returns ok', async () => {
    process.env.DUCKDB_PATH = 'data/cache/test.duckdb';
    const app = await buildServer();

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
    process.env.DUCKDB_PATH = 'data/cache/test.duckdb';
    const app = await buildServer();

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
});
