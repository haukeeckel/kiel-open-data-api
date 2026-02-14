import fp from 'fastify-plugin';

import { type Env, getEnv } from '../../config/env.js';
import { getDuckDbPath } from '../../config/path.js';
import { createDuckDbConnectionManager } from '../../infra/db/duckdbConnectionManager.js';
import { assertMigrationsUpToDate } from '../../infra/db/migrations.js';
import { createDuckDbStatisticsRepository } from '../../infra/db/statisticsRepository.duckdb.js';

import type { FastifyInstance } from 'fastify';

export type RepositoriesPluginOptions = { env?: Env };

export default fp<RepositoriesPluginOptions>(async function repositoriesPlugin(
  app: FastifyInstance,
  opts,
) {
  const env = opts?.env ?? getEnv();
  const dbPath = getDuckDbPath(env);
  const dbLogger = app.log.child({ name: 'db' });
  const dbManager = createDuckDbConnectionManager({ dbPath, poolSize: 4, logger: dbLogger });

  // Migrations must run before app startup via `pnpm migrate`.
  await dbManager.withConnection(assertMigrationsUpToDate);

  const statisticsRepository = createDuckDbStatisticsRepository(dbManager, {
    queryTimeoutMs: env.DB_QUERY_TIMEOUT_MS,
    logger: dbLogger,
  });

  app.decorate('dbManager', dbManager);
  app.decorate('repos', {
    statisticsRepository,
  });

  app.addHook('onClose', async () => {
    await dbManager.close();
  });
});
