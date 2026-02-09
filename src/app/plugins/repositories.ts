import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createDuckDbStatisticsRepository } from '../../infra/db/statisticsRepository.duckdb';

export default fp(async function repositoriesPlugin(app: FastifyInstance) {
  const statisticsRepository = createDuckDbStatisticsRepository();

  app.decorate('repos', {
    statisticsRepository,
  });
});
