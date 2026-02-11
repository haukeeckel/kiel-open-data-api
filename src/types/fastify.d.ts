import 'fastify';

import type { StatisticsRepository } from '../domains/statistics/ports/statisticsRepository.js';
import type { StatisticsQueryService } from '../domains/statistics/services/queryService.js';
import type { DuckDBConnection } from '@duckdb/node-api';

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyInstance {
    dbConn: DuckDBConnection;
    repos: {
      statisticsRepository: StatisticsRepository;
    };
    services: {
      statisticsQuery: StatisticsQueryService;
    };
  }
}

export {};
