import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { StatisticsQueryService } from '../../domains/statistics/services/queryService';

export default fp(async function servicesPlugin(app: FastifyInstance) {
  app.decorate('services', {
    statisticsQuery: new StatisticsQueryService(app.repos.statisticsRepository),
  });
});
