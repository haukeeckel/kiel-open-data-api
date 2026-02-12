import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { ORDERS } from '../../domains/statistics/model/types.js';
import { StatisticsQueryService } from '../../domains/statistics/services/queryService.js';

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
        area: 'Altstadt',
        rows: [],
      }),
      listIndicators: async () => ({ rows: [indicator] }),
      listAreaTypes: async () => ({ rows: [areaType] }),
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
});
