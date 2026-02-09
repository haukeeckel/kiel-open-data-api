import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createDuckDbFactsRepository } from '../../infra/db/factsRepository.duckdb';

export default fp(async function repositoriesPlugin(app: FastifyInstance) {
  const factsRepository = createDuckDbFactsRepository();

  app.decorate('repos', {
    factsRepository,
  });
});
