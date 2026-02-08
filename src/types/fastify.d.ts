import 'fastify';

import type { FactsRepository } from '../domains/statistics/ports/factsRepository';
import type { StatisticsQueryService } from '../domains/statistics/services/queryService';

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyInstance {
    repos: {
      factsRepository: FactsRepository;
    };
    services: {
      statisticsQuery: StatisticsQueryService;
    };
  }
}

export {};
