import 'fastify';

import type { StatisticsRepository } from '../domains/statistics/ports/statisticsRepository';
import type { StatisticsQueryService } from '../domains/statistics/services/queryService';

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyInstance {
    repos: {
      statisticsRepository: StatisticsRepository;
    };
    services: {
      statisticsQuery: StatisticsQueryService;
    };
  }
}

export {};
