import 'fastify';

import type { StatisticsRepository } from '../domains/statistics/ports/statisticsRepository.js';
import type { StatisticsQueryService } from '../domains/statistics/services/queryService.js';
import type { DuckDbConnectionManager } from '../infra/db/duckdbConnectionManager.js';

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyInstance {
    dbManager: DuckDbConnectionManager;
    repos: {
      statisticsRepository: StatisticsRepository;
    };
    services: {
      statisticsQuery: StatisticsQueryService;
    };
  }
}

export {};
