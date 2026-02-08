import type { FastifyInstance } from 'fastify';
import { StatisticsQueryService } from '../../domains/statistics/services/queryService';

export async function registerServices(app: FastifyInstance) {
  app.decorate('services', {
    statisticsQuery: new StatisticsQueryService(app.repos.factsRepository),
  });
}
