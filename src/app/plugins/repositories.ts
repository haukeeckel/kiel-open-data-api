import fp from 'fastify-plugin';

import { type Env, getEnv } from '../../config/env.js';
import { getDuckDbPath } from '../../config/path.js';
import { createDb } from '../../infra/db/duckdb.js';
import { applyMigrations } from '../../infra/db/migrations.js';
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
  const db = await createDb(dbPath, { logger: dbLogger });
  const conn = await db.connect();

  // TODO: consider a dedicated `pnpm migrate` CLI command if migrations
  // become long-running or the app moves to a multi-instance setup.
  await applyMigrations(conn);

  const statisticsRepository = createDuckDbStatisticsRepository(conn);

  app.decorate('dbConn', conn);
  app.decorate('repos', {
    statisticsRepository,
  });

  app.addHook('onClose', () => {
    conn.closeSync();
    db.closeSync();
  });
});
