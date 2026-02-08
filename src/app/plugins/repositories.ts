import type { FastifyInstance } from 'fastify';
import { createDuckDbFactsRepository } from '../../infra/db/factsRepository.duckdb';

export async function registerRepositories(app: FastifyInstance) {
  const factsRepository = createDuckDbFactsRepository();

  app.decorate('repos', {
    factsRepository,
  });
}
