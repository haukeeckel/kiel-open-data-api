import fp from 'fastify-plugin';

import { StatisticsQueryService } from '../../domains/statistics/services/queryService.js';

import type { FastifyInstance } from 'fastify';

export default fp(async function servicesPlugin(app: FastifyInstance) {
  app.decorate('services', {
    statisticsQuery: new StatisticsQueryService(app.repos.statisticsRepository),
  });
});
