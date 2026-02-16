import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { ORDERS } from '../../domains/statistics/model/types.js';
import { StatisticsQueryService } from '../../domains/statistics/services/queryService.js';
import { makeEnv } from '../../test/helpers/makeEnv.js';

import servicesPlugin from './services.js';

describe('services plugin', () => {
  it('decorates statisticsQuery service', async () => {
    const indicator = 'population';
    const areaType = 'district';
    const order = ORDERS[1]!;
    const app = Fastify();
    const statisticsRepository = {
      getRanking: async () => ({
        indicator,
        areaType,
        year: 2023,
        order,
        limit: 1,
        rows: [],
      }),
      listAreas: async () => ({
        indicator,
        areaType,
        rows: [],
      }),
      listCategories: async () => ({
        indicator,
        areaType,
        rows: ['total'],
      }),
      getTimeseries: async () => ({
        indicator,
        areaType,
        areas: ['Altstadt'],
        rows: [],
        pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
      }),
      listYears: async () => ({
        rows: [2023],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
      }),
      getIndicatorMeta: async () => ({
        indicator,
        areaTypes: [{ areaType, years: [2023], categories: ['total'], areas: ['Altstadt'] }],
      }),
      getYearMeta: async () => ({
        year: 2023,
        areaTypes: [
          { areaType, indicators: [indicator], categories: ['total'], areas: ['Altstadt'] },
        ],
      }),
      listIndicators: async () => ({
        rows: [indicator],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
      }),
      listAreaTypes: async () => ({ rows: [areaType] }),
      getCapabilities: async () => ({
        areaTypes: [areaType],
        indicators: [indicator],
        years: [2023],
        limits: {
          pagination: { min: 1, max: 500, default: 50 },
          ranking: { min: 1, max: 100, default: 50 },
        },
      }),
      getFreshnessMeta: async () => ({ dataVersion: 'test-version', lastUpdatedAt: null }),
    };

    app.decorate('repos', { statisticsRepository });

    await app.register(servicesPlugin);

    expect(app.services.statisticsQuery).toBeInstanceOf(StatisticsQueryService);
    const result = await app.services.statisticsQuery.getRanking({
      indicator,
      areaType,
      year: 2023,
      order,
      limit: 1,
    });
    expect(result).toMatchObject({ limit: 1 });
  });

  it('passes validation cache settings from env to query service behavior', async () => {
    const indicator = 'population';
    const areaType = 'district';
    const order = ORDERS[1]!;
    const app = Fastify();
    const statisticsRepository = {
      getRanking: vi.fn(async () => ({
        indicator,
        areaType,
        year: 2023,
        order,
        limit: 1,
        rows: [],
      })),
      listAreas: vi.fn(async () => ({ indicator, areaType, rows: [] })),
      listCategories: vi.fn(async () => ({ indicator, areaType, rows: ['total'] })),
      getTimeseries: vi.fn(async () => ({
        indicator,
        areaType,
        areas: ['Altstadt'],
        rows: [],
        pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
      })),
      listYears: vi.fn(async () => ({
        rows: [2023],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
      })),
      getIndicatorMeta: vi.fn(async () => ({
        indicator,
        areaTypes: [{ areaType, years: [2023], categories: ['total'], areas: ['Altstadt'] }],
      })),
      getYearMeta: vi.fn(async () => ({
        year: 2023,
        areaTypes: [
          { areaType, indicators: [indicator], categories: ['total'], areas: ['Altstadt'] },
        ],
      })),
      listIndicators: vi.fn(async () => ({
        rows: [indicator],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
      })),
      listAreaTypes: vi.fn(async () => ({ rows: [areaType] })),
      getCapabilities: vi.fn(async () => ({
        areaTypes: [areaType],
        indicators: [indicator],
        years: [2023],
        limits: {
          pagination: { min: 1, max: 500, default: 50 },
          ranking: { min: 1, max: 100, default: 50 },
        },
      })),
      getFreshnessMeta: vi.fn(async () => ({ dataVersion: 'test-version', lastUpdatedAt: null })),
    };

    app.decorate('repos', { statisticsRepository });

    await app.register(servicesPlugin, {
      env: makeEnv({
        STATS_VALIDATION_CACHE_ENABLED: false,
        STATS_VALIDATION_CACHE_TTL_MS: 60_000,
      }),
    });

    await app.services.statisticsQuery.getRanking({
      indicator,
      areaType,
      year: 2023,
      order,
      limit: 1,
    });
    await app.services.statisticsQuery.getRanking({
      indicator,
      areaType,
      year: 2023,
      order,
      limit: 1,
    });

    expect(statisticsRepository.listIndicators).toHaveBeenCalledTimes(2);
    expect(statisticsRepository.listAreaTypes).toHaveBeenCalledTimes(2);
  });
});
