import { describe, expect, it, vi } from 'vitest';

import { StatisticsQueryService } from './queryService.js';

import type { StatisticsRepository } from '../ports/statisticsRepository.js';

function createFakeRepo(): StatisticsRepository {
  return {
    async getTimeseries(input) {
      return {
        indicator: input.indicator,
        areaType: input.areaType,
        area: input.area,
        rows: [
          { year: 2023, value: 1, unit: 'persons', category: 'total' },
          { year: 2023, value: 2, unit: 'persons', category: 'single_person' },
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
    async listAreaTypes() {
      return { rows: ['district'] };
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
        area: 'Altstadt',
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
    expect(result.rows).toEqual(['total']);
  });

  it('passes timeseries category through and returns repository rows unchanged', async () => {
    const repo = createFakeRepo();
    const getTimeseriesSpy = vi.spyOn(repo, 'getTimeseries');
    const svc = new StatisticsQueryService(repo);

    const result = await svc.getTimeseries({
      indicator: 'households',
      areaType: 'district',
      area: 'Altstadt',
      category: 'single_person',
    });

    expect(getTimeseriesSpy).toHaveBeenCalledWith({
      indicator: 'households',
      areaType: 'district',
      area: 'Altstadt',
      category: 'single_person',
    });
    expect(result.rows).toEqual([
      { year: 2023, value: 1, unit: 'persons', category: 'total' },
      { year: 2023, value: 2, unit: 'persons', category: 'single_person' },
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
      category: 'single_person',
    });

    expect(getRankingSpy).toHaveBeenCalledWith({
      indicator: 'households',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
      category: 'single_person',
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
      area: 'Altstadt',
    });

    expect(getTimeseriesSpy).toHaveBeenCalledWith({
      indicator: 'households',
      areaType: 'district',
      area: 'Altstadt',
    });
    expect(result.rows).toEqual([
      { year: 2023, value: 1, unit: 'persons', category: 'total' },
      { year: 2023, value: 2, unit: 'persons', category: 'single_person' },
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

  it('passes listIndicators through to repository', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    const result = await svc.listIndicators();
    expect(result.rows).toEqual(['households', 'population']);
  });

  it('passes listAreaTypes through to repository', async () => {
    const svc = new StatisticsQueryService(createFakeRepo());

    const result = await svc.listAreaTypes();
    expect(result.rows).toEqual(['district']);
  });
});
