import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { resetMetricsForTests, metricsRegistry } from '../../observability/metrics.js';

import { RepositoryInfraError, RepositoryQueryTimeoutError } from './errors.js';
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
    repo = createDuckDbStatisticsRepository(manager, { queryTimeoutMs: 2_000 });

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
      ('households', 'district', 'Gaarden-Ost',    2023, 3220, 'households', 'single_person'),
      ('households', 'district', 'Wik',            2023, 420, 'households', 'single_person');
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
        areas: ['Altstadt'],
      });

      expect(result).toEqual({
        indicator: 'population',
        areaType: 'district',
        areas: ['Altstadt'],
        rows: [
          { area: 'Altstadt', year: 2022, value: 1213, unit: 'persons', category: 'total' },
          { area: 'Altstadt', year: 2023, value: 1220, unit: 'persons', category: 'total' },
        ],
      });
    });

    it('returns empty rows for a non-existent area', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        areas: ['NonExistent'],
      });

      expect(result.rows).toEqual([]);
    });

    it('filters by from/to year range', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        areas: ['Altstadt'],
        from: 2023,
        to: 2023,
      });

      expect(result.rows).toEqual([
        { area: 'Altstadt', year: 2023, value: 1220, unit: 'persons', category: 'total' },
      ]);
    });

    it('filters by from only', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        areas: ['Gaarden-Ost'],
        from: 2023,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.year).toBe(2023);
    });

    it('filters by to only', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        areas: ['Gaarden-Ost'],
        to: 2022,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.year).toBe(2022);
    });

    it('returns rows ordered by year ascending', async () => {
      const result = await repo.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        areas: ['Gaarden-Ost'],
      });

      const years = result.rows.map((r) => r.year);
      expect(years).toEqual([2022, 2023]);
    });

    it('returns unfiltered rows when category is omitted', async () => {
      const result = await repo.getTimeseries({
        indicator: 'households',
        areaType: 'district',
        areas: ['Altstadt'],
      });

      expect(result.rows).toEqual([
        { area: 'Altstadt', year: 2023, value: 810, unit: 'households', category: 'total' },
        {
          area: 'Altstadt',
          year: 2023,
          value: 505,
          unit: 'households',
          category: 'single_person',
        },
      ]);
    });

    it('supports multiple areas and categories', async () => {
      const result = await repo.getTimeseries({
        indicator: 'households',
        areaType: 'district',
        areas: ['Altstadt', 'Gaarden-Ost'],
        categories: ['single_person', 'total'],
      });

      expect(result.areas).toEqual(['Altstadt', 'Gaarden-Ost']);
      expect(result.rows).toEqual([
        { area: 'Altstadt', year: 2023, value: 810, unit: 'households', category: 'total' },
        {
          area: 'Altstadt',
          year: 2023,
          value: 505,
          unit: 'households',
          category: 'single_person',
        },
        {
          area: 'Gaarden-Ost',
          year: 2023,
          value: 6050,
          unit: 'households',
          category: 'total',
        },
        {
          area: 'Gaarden-Ost',
          year: 2023,
          value: 3220,
          unit: 'households',
          category: 'single_person',
        },
      ]);
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

    it('filters areas by category', async () => {
      const result = await repo.listAreas({
        indicator: 'households',
        areaType: 'district',
        category: 'single_person',
      });

      expect(result.rows).toEqual(['Altstadt', 'Gaarden-Ost', 'Wik']);
    });

    it('returns areas across all categories when category is omitted', async () => {
      const result = await repo.listAreas({
        indicator: 'households',
        areaType: 'district',
      });

      expect(result.rows).toEqual(['Altstadt', 'Gaarden-Ost', 'Wik']);
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

    it('returns mixed-category ranking when category is omitted', async () => {
      const result = await repo.getRanking({
        indicator: 'households',
        areaType: 'district',
        year: 2023,
        limit: 10,
        order: 'desc',
      });

      expect(result.rows).toEqual([
        { area: 'Gaarden-Ost', value: 6050, unit: 'households', category: 'total' },
        { area: 'Gaarden-Ost', value: 3220, unit: 'households', category: 'single_person' },
        { area: 'Altstadt', value: 810, unit: 'households', category: 'total' },
        { area: 'Altstadt', value: 505, unit: 'households', category: 'single_person' },
        { area: 'Wik', value: 420, unit: 'households', category: 'single_person' },
      ]);
    });

    it('filters ranking by multiple categories', async () => {
      const result = await repo.getRanking({
        indicator: 'households',
        areaType: 'district',
        year: 2023,
        limit: 10,
        order: 'desc',
        categories: ['single_person'],
      });

      expect(result.rows).toEqual([
        { area: 'Gaarden-Ost', value: 3220, unit: 'households', category: 'single_person' },
        { area: 'Altstadt', value: 505, unit: 'households', category: 'single_person' },
        { area: 'Wik', value: 420, unit: 'households', category: 'single_person' },
      ]);
    });

    it('filters ranking by multiple areas', async () => {
      const result = await repo.getRanking({
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        limit: 10,
        order: 'desc',
        areas: ['Altstadt', 'Schreventeich'],
      });

      expect(result.rows).toEqual([
        { area: 'Schreventeich', value: 9000, unit: 'persons', category: 'total' },
        { area: 'Altstadt', value: 1220, unit: 'persons', category: 'total' },
      ]);
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

  describe('listYears', () => {
    it('returns distinct years sorted ascending without filters', async () => {
      const result = await repo.listYears();
      expect(result).toEqual({ rows: [2022, 2023] });
    });

    it('filters by indicator', async () => {
      const result = await repo.listYears({ indicator: 'households' });
      expect(result.rows).toEqual([2023]);
    });

    it('filters by areaType', async () => {
      const result = await repo.listYears({ areaType: 'district' });
      expect(result.rows).toEqual([2022, 2023]);
    });

    it('respects category filter', async () => {
      const result = await repo.listYears({
        category: 'single_person',
      });

      expect(result.rows).toEqual([2023]);
    });

    it('filters by area', async () => {
      const result = await repo.listYears({ area: 'Wik' });
      expect(result.rows).toEqual([2023]);
    });

    it('supports combined filters', async () => {
      const result = await repo.listYears({
        indicator: 'population',
        areaType: 'district',
        category: 'total',
        area: 'Altstadt',
      });
      expect(result.rows).toEqual([2022, 2023]);
    });

    it('returns empty rows when nothing matches', async () => {
      const result = await repo.listYears({ indicator: 'unknown' });
      expect(result.rows).toEqual([]);
    });
  });

  describe('getIndicatorMeta', () => {
    it('returns grouped metadata with deterministic ordering', async () => {
      const result = await repo.getIndicatorMeta('households');

      expect(result).toEqual({
        indicator: 'households',
        areaTypes: [
          {
            areaType: 'district',
            years: [2023],
            categories: ['single_person', 'total'],
            areas: ['Altstadt', 'Gaarden-Ost', 'Wik'],
          },
        ],
      });
    });

    it('returns null for unknown indicator', async () => {
      const result = await repo.getIndicatorMeta('unknown');
      expect(result).toBeNull();
    });
  });

  describe('getYearMeta', () => {
    it('returns grouped metadata with deterministic ordering', async () => {
      const result = await repo.getYearMeta(2023);

      expect(result).toMatchObject({
        year: 2023,
        areaTypes: [
          {
            areaType: 'district',
            indicators: expect.arrayContaining(['households', 'population']),
            categories: expect.arrayContaining(['single_person', 'total']),
            areas: ['Altstadt', 'Gaarden-Ost', 'Schreventeich', 'Wik'],
          },
        ],
      });
      expect(result?.areaTypes[0]?.indicators).toEqual(['households', 'population']);
    });

    it('returns null for unknown year', async () => {
      const result = await repo.getYearMeta(1999);
      expect(result).toBeNull();
    });
  });

  describe('listIndicators', () => {
    it('returns distinct indicators sorted', async () => {
      const result = await repo.listIndicators();

      expect(result.rows).toEqual(['households', 'population']);
    });

    it('filters by areaType', async () => {
      const result = await repo.listIndicators({ areaType: 'district' });
      expect(result.rows).toEqual(['households', 'population']);
    });

    it('filters by area', async () => {
      const result = await repo.listIndicators({ area: 'Wik' });
      expect(result.rows).toEqual(['households']);
    });

    it('filters by year', async () => {
      const result = await repo.listIndicators({ year: 2022 });
      expect(result.rows).toEqual(['population']);
    });

    it('supports combined filters', async () => {
      const result = await repo.listIndicators({
        areaType: 'district',
        area: 'Altstadt',
        year: 2023,
      });
      expect(result.rows).toEqual(['households', 'population']);
    });
  });

  describe('listAreaTypes', () => {
    it('returns distinct area types sorted', async () => {
      const result = await repo.listAreaTypes();

      expect(result.rows).toEqual(['district']);
    });
  });

  describe('error handling', () => {
    it('interrupts and throws RepositoryQueryTimeoutError on timeout', async () => {
      const interrupt = vi.fn();
      const mockConn = {
        runAndReadAll: vi.fn(() => new Promise(() => undefined)),
        interrupt,
      } as unknown as DuckDBConnection;

      const manager: DuckDbConnectionManager = {
        withConnection: async (fn) => fn(mockConn),
        healthcheck: async () => true,
        close: async () => undefined,
      };
      const timedRepo = createDuckDbStatisticsRepository(manager, { queryTimeoutMs: 1 });

      await expect(timedRepo.listIndicators()).rejects.toBeInstanceOf(RepositoryQueryTimeoutError);
      expect(interrupt).toHaveBeenCalledTimes(1);
    });

    it('wraps db failures in RepositoryInfraError', async () => {
      const mockConn = {
        runAndReadAll: vi.fn(async () => {
          throw new Error('db boom');
        }),
        interrupt: vi.fn(),
      } as unknown as DuckDBConnection;

      const manager: DuckDbConnectionManager = {
        withConnection: async (fn) => fn(mockConn),
        healthcheck: async () => true,
        close: async () => undefined,
      };
      const failingRepo = createDuckDbStatisticsRepository(manager, { queryTimeoutMs: 50 });

      await expect(failingRepo.listIndicators()).rejects.toBeInstanceOf(RepositoryInfraError);
    });

    it('rejects non-string values in requireString path', async () => {
      const mockReader = {
        getRowObjects: () => [{ indicator: 123 }],
      };
      const mockConn = {
        runAndReadAll: vi.fn(async () => mockReader),
        interrupt: vi.fn(),
      } as unknown as DuckDBConnection;

      const manager: DuckDbConnectionManager = {
        withConnection: async (fn) => fn(mockConn),
        healthcheck: async () => true,
        close: async () => undefined,
      };
      const strictRepo = createDuckDbStatisticsRepository(manager, { queryTimeoutMs: 50 });

      await expect(strictRepo.listIndicators()).rejects.toBeInstanceOf(RepositoryInfraError);
    });

    it('keeps timeout classification when query rejects after interrupt', async () => {
      let rejectQuery: ((err: unknown) => void) | undefined;
      const interrupt = vi.fn(() => {
        rejectQuery?.(new Error('interrupted by timeout'));
      });
      const mockConn = {
        runAndReadAll: vi.fn(
          () =>
            new Promise((_, reject) => {
              rejectQuery = reject;
            }),
        ),
        interrupt,
      } as unknown as DuckDBConnection;

      const manager: DuckDbConnectionManager = {
        withConnection: async (fn) => fn(mockConn),
        healthcheck: async () => true,
        close: async () => undefined,
      };
      const timedRepo = createDuckDbStatisticsRepository(manager, { queryTimeoutMs: 1 });

      await expect(timedRepo.listIndicators()).rejects.toBeInstanceOf(RepositoryQueryTimeoutError);
      expect(interrupt).toHaveBeenCalledTimes(1);
    });
  });

  describe('query metrics', () => {
    it('records ok status metrics for successful queries', async () => {
      resetMetricsForTests();

      await repo.listIndicators();
      const text = await metricsRegistry.metrics();

      expect(text).toMatch(
        /db_queries_total\{operation="statistics\.listIndicators",status="ok"\}\s+1/,
      );
      expect(text).toMatch(
        /db_query_duration_seconds_(bucket|sum|count)\{operation="statistics\.listIndicators",status="ok"/,
      );
    });

    it('records timeout status metrics', async () => {
      resetMetricsForTests();

      const interrupt = vi.fn();
      const mockConn = {
        runAndReadAll: vi.fn(() => new Promise(() => undefined)),
        interrupt,
      } as unknown as DuckDBConnection;

      const manager: DuckDbConnectionManager = {
        withConnection: async (fn) => fn(mockConn),
        healthcheck: async () => true,
        close: async () => undefined,
      };
      const timedRepo = createDuckDbStatisticsRepository(manager, { queryTimeoutMs: 1 });

      await expect(timedRepo.listIndicators()).rejects.toBeInstanceOf(RepositoryQueryTimeoutError);
      expect(interrupt).toHaveBeenCalledTimes(1);

      const text = await metricsRegistry.metrics();
      expect(text).toMatch(
        /db_queries_total\{operation="statistics\.listIndicators",status="timeout"\}\s+1/,
      );
      expect(text).toMatch(
        /db_query_duration_seconds_(bucket|sum|count)\{operation="statistics\.listIndicators",status="timeout"/,
      );
    });

    it('records error status metrics', async () => {
      resetMetricsForTests();

      const mockConn = {
        runAndReadAll: vi.fn(async () => {
          throw new Error('db boom');
        }),
        interrupt: vi.fn(),
      } as unknown as DuckDBConnection;

      const manager: DuckDbConnectionManager = {
        withConnection: async (fn) => fn(mockConn),
        healthcheck: async () => true,
        close: async () => undefined,
      };
      const failingRepo = createDuckDbStatisticsRepository(manager, { queryTimeoutMs: 50 });

      await expect(failingRepo.listIndicators()).rejects.toBeInstanceOf(RepositoryInfraError);

      const text = await metricsRegistry.metrics();
      expect(text).toMatch(
        /db_queries_total\{operation="statistics\.listIndicators",status="error"\}\s+1/,
      );
      expect(text).toMatch(
        /db_query_duration_seconds_(bucket|sum|count)\{operation="statistics\.listIndicators",status="error"/,
      );
    });
  });
});
