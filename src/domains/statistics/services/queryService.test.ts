import { describe, expect, it } from 'vitest';
import { StatisticsQueryService } from './queryService.js';
import type { StatisticsRepository } from '../ports/statisticsRepository.js';

function createFakeRepo(): StatisticsRepository {
  return {
    async getTimeseries(input) {
      return {
        indicator: input.indicator,
        areaType: input.areaType,
        area: input.area,
        rows: [{ year: 2023, value: 1, unit: 'persons' }],
      };
    },
    async listAreas(input) {
      return {
        indicator: input.indicator,
        areaType: input.areaType,
        rows: ['Altstadt'],
      };
    },
    async getRanking(input) {
      return {
        indicator: input.indicator,
        areaType: input.areaType,
        year: input.year,
        order: input.order,
        limit: input.limit,
        rows: [{ area: 'Altstadt', value: 1, unit: 'persons' }],
      };
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
});
