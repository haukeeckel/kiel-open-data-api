import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { applyMigrations } from './migrations.js';
import { createDuckDbStatisticsRepository } from './statisticsRepository.duckdb.js';

import type { DuckDbConnectionManager } from './duckdbConnectionManager.js';
import type { StatisticsRepository } from '../../domains/statistics/ports/statisticsRepository.js';

describe('DuckDbStatisticsRepository', () => {
  let conn: DuckDBConnection;
  let repo: StatisticsRepository;

  beforeAll(async () => {
    const db = await DuckDBInstance.create(':memory:');
    conn = await db.connect();
    const manager: DuckDbConnectionManager = {
      withConnection: async (fn) => fn(conn),
      healthcheck: async () => true,
      close: async () => undefined,
    };
    repo = createDuckDbStatisticsRepository(manager);

    await applyMigrations(conn);

    await conn.run(`
      INSERT INTO statistics (indicator, area_type, area_name, year, value, unit, category) VALUES
      ('population', 'district', 'Altstadt',       2022, 1213, 'persons', 'total'),
      ('population', 'district', 'Altstadt',       2023, 1220, 'persons', 'total'),
      ('population', 'district', 'Gaarden-Ost',    2022, 17500, 'persons', 'total'),
      ('population', 'district', 'Gaarden-Ost',    2023, 18000, 'persons', 'total'),
      ('population', 'district', 'Schreventeich',  2023, 9000, 'persons', 'total'),
      ('households', 'district', 'Altstadt',       2023, 810, 'households', 'total'),
      ('households', 'district', 'Altstadt',       2023, 505, 'households', 'single_person'),
      ('households', 'district', 'Gaarden-Ost',    2023, 6050, 'households', 'total'),
      ('households', 'district', 'Gaarden-Ost',    2023, 3220, 'households', 'single_person');
    `);
  });

  afterAll(() => {
    conn.closeSync();
  });

  describe('getTimeseries', () => {
    it('returns rows for a matching area', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        area: 'Altstadt',
      });

      expect(result).toEqual({
        indicator: 'population',
        areaType: 'district',
        area: 'Altstadt',
        rows: [
          { year: 2022, value: 1213, unit: 'persons', category: 'total' },
          { year: 2023, value: 1220, unit: 'persons', category: 'total' },
        ],
      });
    });

    it('returns empty rows for a non-existent area', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        area: 'NonExistent',
      });

      expect(result.rows).toEqual([]);
    });

    it('filters by from/to year range', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        area: 'Altstadt',
        from: 2023,
        to: 2023,
      });

      expect(result.rows).toEqual([
        { year: 2023, value: 1220, unit: 'persons', category: 'total' },
      ]);
    });

    it('filters by from only', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        area: 'Gaarden-Ost',
        from: 2023,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.year).toBe(2023);
    });

    it('filters by to only', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        area: 'Gaarden-Ost',
        to: 2022,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.year).toBe(2022);
    });

    it('returns rows ordered by year ascending', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        area: 'Gaarden-Ost',
      });

      const years = result.rows.map((r) => r.year);
      expect(years).toEqual([2022, 2023]);
    });
  });

  describe('listAreas', () => {
    it('returns distinct areas sorted alphabetically', async () => {
      const result = await repo.listAreas({
        indicator: 'population',
        areaType: 'district',
      });

      expect(result.rows).toEqual(['Altstadt', 'Gaarden-Ost', 'Schreventeich']);
    });

    it('returns empty rows for non-existent indicator', async () => {
      const result = await repo.listAreas({
        indicator: 'unknown',
        areaType: 'district',
      });

      expect(result.rows).toEqual([]);
    });

    it('filters by like (case-insensitive)', async () => {
      const result = await repo.listAreas({
        indicator: 'population',
        areaType: 'district',
        like: 'gaard',
      });

      expect(result.rows).toEqual(['Gaarden-Ost']);
    });

    it('returns empty when like matches nothing', async () => {
      const result = await repo.listAreas({
        indicator: 'population',
        areaType: 'district',
        like: 'zzz',
      });

      expect(result.rows).toEqual([]);
    });
  });

  describe('getRanking', () => {
    it('returns ranking descending by default', async () => {
      const result = await repo.getRanking({
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        limit: 10,
        order: 'desc',
      });

      expect(result.rows).toEqual([
        { area: 'Gaarden-Ost', value: 18000, unit: 'persons', category: 'total' },
        { area: 'Schreventeich', value: 9000, unit: 'persons', category: 'total' },
        { area: 'Altstadt', value: 1220, unit: 'persons', category: 'total' },
      ]);
    });

    it('returns ranking ascending', async () => {
      const result = await repo.getRanking({
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        limit: 10,
        order: 'asc',
      });

      expect(result.rows[0]).toEqual({
        area: 'Altstadt',
        value: 1220,
        unit: 'persons',
        category: 'total',
      });
    });

    it('respects limit', async () => {
      const result = await repo.getRanking({
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        limit: 1,
        order: 'desc',
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.area).toBe('Gaarden-Ost');
    });

    it('returns empty for a year with no data', async () => {
      const result = await repo.getRanking({
        indicator: 'population',
        areaType: 'district',
        year: 1999,
        limit: 10,
        order: 'desc',
      });

      expect(result.rows).toEqual([]);
    });

    it('returns correct metadata', async () => {
      const result = await repo.getRanking({
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        limit: 5,
        order: 'asc',
      });

      expect(result.indicator).toBe('population');
      expect(result.areaType).toBe('district');
      expect(result.year).toBe(2023);
      expect(result.order).toBe('asc');
      expect(result.limit).toBe(5);
    });
  });

  describe('listCategories', () => {
    it('returns distinct categories sorted', async () => {
      const result = await repo.listCategories({
        indicator: 'households',
        areaType: 'district',
      });

      expect(result.rows).toEqual(['single_person', 'total']);
    });
  });

  describe('listIndicators', () => {
    it('returns distinct indicators sorted', async () => {
      const result = await repo.listIndicators();

      expect(result.rows).toEqual(['households', 'population']);
    });
  });

  describe('listAreaTypes', () => {
    it('returns distinct area types sorted', async () => {
      const result = await repo.listAreaTypes();

      expect(result.rows).toEqual(['district']);
    });
  });
});
