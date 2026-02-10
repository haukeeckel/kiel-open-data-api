import 'fastify';

import type { DuckDBConnection } from '@duckdb/node-api';
import type { StatisticsRepository } from '../domains/statistics/ports/statisticsRepository';
import type { StatisticsQueryService } from '../domains/statistics/services/queryService';

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
