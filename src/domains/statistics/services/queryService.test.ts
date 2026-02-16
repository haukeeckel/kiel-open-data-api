import { describe, expect, it, vi } from 'vitest';

import { StatisticsQueryService } from './queryService.js';

import type { StatisticsRepository } from '../ports/statisticsRepository.js';

function createFakeRepo(): StatisticsRepository {
  return {
    async getTimeseries(input) {
      return {
        indicator: input.indicator,
        areaType: input.areaType,
        areas: input.areas,
        rows: [
          { area: 'Altstadt', year: 2023, value: 1, unit: 'persons', category: 'total' },
          {
            area: 'Altstadt',
            year: 2023,
            value: 2,
            unit: 'persons',
            category: 'single_person',
          },
        ],
      };
    },
    async listAreas(input) {
      return {
        indicator: input.indicator,
        areaType: input.areaType,
        rows: ['Altstadt'],
      };
    },
    async listCategories(input) {
      if (input.indicator === 'households') {
        return {
          indicator: input.indicator,
          areaType: input.areaType,
          rows: ['single_person', 'total'],
        };
      }
      return {
        indicator: input.indicator,
        areaType: input.areaType,
        rows: ['total'],
      };
    },
    async getRanking(input) {
      return {
        indicator: input.indicator,
        areaType: input.areaType,
        year: input.year,
        order: input.order,
        limit: input.limit,
        rows: [
          { area: 'Altstadt', value: 1, unit: 'persons', category: 'total' },
          { area: 'Altstadt', value: 2, unit: 'persons', category: 'single_person' },
        ],
      };
    },
    async listIndicators() {
      return { rows: ['households', 'population'] };
    },
    async listYears(input) {
      if (!input || (input.indicator === undefined && input.areaType === undefined)) {
        return { rows: [2022, 2023] };
      }
      if (
        input.indicator === 'population' &&
        input.areaType === 'district' &&
        (input.category === undefined || input.category === 'total')
      ) {
        return { rows: [2022, 2023] };
      }
      return { rows: [] };
    },
    async getYearMeta(year) {
      if (year !== 2023) return null;
      return {
        year,
        areaTypes: [
          {
            areaType: 'district',
            indicators: ['population'],
            categories: ['total'],
            areas: ['Altstadt'],
          },
        ],
      };
    },
    async getIndicatorMeta(indicator) {
      if (indicator !== 'population') return null;
      return {
        indicator,
        areaTypes: [
          {
            areaType: 'district',
            years: [2022, 2023],
            categories: ['total'],
            areas: ['Altstadt'],
          },
        ],
      };
    },
    async listAreaTypes() {
      return { rows: ['district'] };
    },
    async getFreshnessMeta() {
      return { dataVersion: 'test-version', lastUpdatedAt: null };
    },
  };
}

describe('StatisticsQueryService', () => {
  it('throws if from > to', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    await expect(
      svc.getTimeseries({
        indicator: 'population',
        areaType: 'district',
        areas: ['Altstadt'],
        from: 2024,
        to: 2023,
      }),
    ).rejects.toThrow(/from must be <= to/i);
  });

  it('passes ranking input through to repository', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    const result = await svc.getRanking({
      indicator: 'population',
      areaType: 'district',
      year: 2023,
      order: 'desc',
      limit: 25,
    });
    expect(result.limit).toBe(25);
  });

  it('passes categories input through to repository', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    const result = await svc.listCategories({
      indicator: 'households',
      areaType: 'district',
    });
    expect(result.rows).toEqual(['single_person', 'total']);
  });

  it('passes timeseries category through and returns repository rows unchanged', async () => {
    const repo = createFakeRepo();
    const getTimeseriesSpy = vi.spyOn(repo, 'getTimeseries');
    const svc = new StatisticsQueryService(repo);

    const result = await svc.getTimeseries({
      indicator: 'households',
      areaType: 'district',
      areas: ['Altstadt'],
      categories: ['single_person'],
    });

    expect(getTimeseriesSpy).toHaveBeenCalledWith({
      indicator: 'households',
      areaType: 'district',
      areas: ['Altstadt'],
      categories: ['single_person'],
    });
    expect(result.rows).toEqual([
      { area: 'Altstadt', year: 2023, value: 1, unit: 'persons', category: 'total' },
      { area: 'Altstadt', year: 2023, value: 2, unit: 'persons', category: 'single_person' },
    ]);
  });

  it('passes ranking category through and returns repository rows unchanged', async () => {
    const repo = createFakeRepo();
    const getRankingSpy = vi.spyOn(repo, 'getRanking');
    const svc = new StatisticsQueryService(repo);

    const result = await svc.getRanking({
      indicator: 'households',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
      categories: ['single_person'],
    });

    expect(getRankingSpy).toHaveBeenCalledWith({
      indicator: 'households',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
      categories: ['single_person'],
    });
    expect(result.rows).toEqual([
      { area: 'Altstadt', value: 1, unit: 'persons', category: 'total' },
      { area: 'Altstadt', value: 2, unit: 'persons', category: 'single_person' },
    ]);
  });

  it('omits category in repository call and returns unfiltered timeseries rows', async () => {
    const repo = createFakeRepo();
    const getTimeseriesSpy = vi.spyOn(repo, 'getTimeseries');
    const svc = new StatisticsQueryService(repo);

    const result = await svc.getTimeseries({
      indicator: 'households',
      areaType: 'district',
      areas: ['Altstadt'],
    });

    expect(getTimeseriesSpy).toHaveBeenCalledWith({
      indicator: 'households',
      areaType: 'district',
      areas: ['Altstadt'],
    });
    expect(result.rows).toEqual([
      { area: 'Altstadt', year: 2023, value: 1, unit: 'persons', category: 'total' },
      { area: 'Altstadt', year: 2023, value: 2, unit: 'persons', category: 'single_person' },
    ]);
  });

  it('omits category in repository call and returns unfiltered ranking rows', async () => {
    const repo = createFakeRepo();
    const getRankingSpy = vi.spyOn(repo, 'getRanking');
    const svc = new StatisticsQueryService(repo);

    const result = await svc.getRanking({
      indicator: 'households',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
    });

    expect(getRankingSpy).toHaveBeenCalledWith({
      indicator: 'households',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
    });
    expect(result.rows).toEqual([
      { area: 'Altstadt', value: 1, unit: 'persons', category: 'total' },
      { area: 'Altstadt', value: 2, unit: 'persons', category: 'single_person' },
    ]);
  });

  it('passes multiple categories through for ranking', async () => {
    const repo = createFakeRepo();
    const getRankingSpy = vi.spyOn(repo, 'getRanking');
    const svc = new StatisticsQueryService(repo);

    await svc.getRanking({
      indicator: 'households',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
      categories: ['single_person', 'total'],
      areas: ['Altstadt', 'Gaarden-Ost'],
    });

    expect(getRankingSpy).toHaveBeenCalledWith({
      indicator: 'households',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
      categories: ['single_person', 'total'],
      areas: ['Altstadt', 'Gaarden-Ost'],
    });
  });

  it('passes listIndicators through to repository', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    const result = await svc.listIndicators();
    expect(result.rows).toEqual(['households', 'population']);
  });

  it('passes listIndicators filters through to repository', async () => {
    const repo = createFakeRepo();
    const listIndicatorsSpy = vi.spyOn(repo, 'listIndicators');
    const svc = new StatisticsQueryService(repo);

    await svc.listIndicators({ areaType: 'district', area: 'Altstadt', year: 2023 });

    expect(listIndicatorsSpy).toHaveBeenCalledWith({
      areaType: 'district',
      area: 'Altstadt',
      year: 2023,
    });
  });

  it('passes listAreaTypes through to repository', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    const result = await svc.listAreaTypes();
    expect(result.rows).toEqual(['district']);
  });

  it('reuses validation lookups within TTL when cache is enabled', async () => {
    const repo = createFakeRepo();
    const listIndicatorsSpy = vi.spyOn(repo, 'listIndicators');
    const listAreaTypesSpy = vi.spyOn(repo, 'listAreaTypes');
    const svc = new StatisticsQueryService(repo, {
      validationCacheEnabled: true,
      validationCacheTtlMs: 30_000,
    });

    await svc.getRanking({
      indicator: 'population',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
    });
    await svc.getRanking({
      indicator: 'population',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
    });

    expect(listIndicatorsSpy).toHaveBeenCalledTimes(1);
    expect(listAreaTypesSpy).toHaveBeenCalledTimes(1);
  });

  it('refreshes validation cache entries after TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    try {
      const repo = createFakeRepo();
      const listIndicatorsSpy = vi.spyOn(repo, 'listIndicators');
      const svc = new StatisticsQueryService(repo, {
        validationCacheEnabled: true,
        validationCacheTtlMs: 1_000,
      });

      await svc.getRanking({
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        limit: 10,
        order: 'desc',
      });
      vi.setSystemTime(new Date('2026-01-01T00:00:02Z'));
      await svc.getRanking({
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        limit: 10,
        order: 'desc',
      });

      expect(listIndicatorsSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses category cache per indicator/areaType key', async () => {
    const repo = createFakeRepo();
    const listCategoriesSpy = vi.spyOn(repo, 'listCategories');
    const svc = new StatisticsQueryService(repo, {
      validationCacheEnabled: true,
      validationCacheTtlMs: 30_000,
    });

    await svc.getRanking({
      indicator: 'households',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
      categories: ['total'],
    });
    await svc.getRanking({
      indicator: 'households',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
      categories: ['single_person'],
    });
    await svc.getRanking({
      indicator: 'population',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
      categories: ['total'],
    });

    expect(listCategoriesSpy).toHaveBeenCalledTimes(2);
  });

  it('calls repository validations each time when cache is disabled', async () => {
    const repo = createFakeRepo();
    const listIndicatorsSpy = vi.spyOn(repo, 'listIndicators');
    const svc = new StatisticsQueryService(repo, {
      validationCacheEnabled: false,
      validationCacheTtlMs: 30_000,
    });

    await svc.getRanking({
      indicator: 'population',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
    });
    await svc.getRanking({
      indicator: 'population',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
    });

    expect(listIndicatorsSpy).toHaveBeenCalledTimes(2);
  });

  it('passes listYears filters through to repository', async () => {
    const repo = createFakeRepo();
    const listYearsSpy = vi.spyOn(repo, 'listYears');
    const svc = new StatisticsQueryService(repo);

    const result = await svc.listYears({
      indicator: 'population',
      areaType: 'district',
      category: 'total',
      area: 'Altstadt',
    });

    expect(listYearsSpy).toHaveBeenCalledWith({
      indicator: 'population',
      areaType: 'district',
      category: 'total',
      area: 'Altstadt',
    });
    expect(result.rows).toEqual([2022, 2023]);
  });

  it('returns empty list when listYears has no matches', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    await expect(
      svc.listYears({
        indicator: 'population',
        areaType: 'district',
        category: 'single_person',
      }),
    ).resolves.toEqual({ rows: [] });
  });

  it('validates areaType when passed to listYears', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    await expect(svc.listYears({ areaType: 'unknown' })).rejects.toMatchObject({
      name: 'StatisticsValidationError',
      message: 'Unknown areaType: unknown',
      details: {
        kind: 'domain_validation',
        field: 'areaType',
        value: 'unknown',
        allowed: ['district'],
      },
    });
  });

  it('returns year metadata from repository', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    const result = await svc.getYearMeta(2023);

    expect(result).toEqual({
      year: 2023,
      areaTypes: [
        {
          areaType: 'district',
          indicators: ['population'],
          categories: ['total'],
          areas: ['Altstadt'],
        },
      ],
    });
  });

  it('throws not found when year metadata does not exist', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    await expect(svc.getYearMeta(1999)).rejects.toMatchObject({
      name: 'StatisticsNotFoundError',
      message: 'Year not found: 1999',
    });
  });

  it('returns indicator metadata from repository', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    const result = await svc.getIndicatorMeta('population');

    expect(result).toEqual({
      indicator: 'population',
      areaTypes: [
        {
          areaType: 'district',
          years: [2022, 2023],
          categories: ['total'],
          areas: ['Altstadt'],
        },
      ],
    });
  });

  it('throws not found when indicator metadata does not exist', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    await expect(svc.getIndicatorMeta('unknown')).rejects.toMatchObject({
      name: 'StatisticsNotFoundError',
      message: 'Indicator not found: unknown',
    });
  });

  it('throws domain validation error for unknown indicator', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    await expect(
      svc.listAreas({
        indicator: 'unknown',
        areaType: 'district',
      }),
    ).rejects.toMatchObject({
      name: 'StatisticsValidationError',
      message: 'Unknown indicator: unknown',
      details: {
        kind: 'domain_validation',
        field: 'indicator',
        value: 'unknown',
        allowed: ['households', 'population'],
      },
    });
  });

  it('throws domain validation error for unknown areaType', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    await expect(
      svc.getRanking({
        indicator: 'population',
        areaType: 'unknown',
        year: 2023,
        limit: 10,
        order: 'desc',
      }),
    ).rejects.toMatchObject({
      name: 'StatisticsValidationError',
      message: 'Unknown areaType: unknown',
      details: {
        kind: 'domain_validation',
        field: 'areaType',
        value: 'unknown',
        allowed: ['district'],
      },
    });
  });

  it('throws domain validation error for unknown category', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    await expect(
      svc.getTimeseries({
        indicator: 'households',
        areaType: 'district',
        areas: ['Altstadt'],
        categories: ['other'],
      }),
    ).rejects.toMatchObject({
      name: 'StatisticsValidationError',
      message: 'Unknown category: other',
      details: {
        kind: 'domain_validation',
        field: 'category',
        value: 'other',
        allowed: ['single_person', 'total'],
      },
    });
  });
});
