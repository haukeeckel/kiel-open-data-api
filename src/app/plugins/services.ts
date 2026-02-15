import fp from 'fastify-plugin';

import { type Env, getEnv } from '../../config/env.js';
import { StatisticsQueryService } from '../../domains/statistics/services/queryService.js';

import type { FastifyInstance } from 'fastify';

export type ServicesPluginOptions = { env?: Env };

export default fp<ServicesPluginOptions>(async function servicesPlugin(app: FastifyInstance, opts) {
  const env = opts?.env ?? getEnv();
  app.decorate('services', {
    statisticsQuery: new StatisticsQueryService(app.repos.statisticsRepository, {
      validationCacheEnabled: env.STATS_VALIDATION_CACHE_ENABLED,
      validationCacheTtlMs: env.STATS_VALIDATION_CACHE_TTL_MS,
    }),
  });
});
