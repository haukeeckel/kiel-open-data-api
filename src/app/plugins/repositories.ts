import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { getEnv } from '../../config/env.js';
import { getDuckDbPath } from '../../config/path.js';
import { createDb } from '../../infra/db/duckdb.js';
import { createDuckDbStatisticsRepository } from '../../infra/db/statisticsRepository.duckdb.js';

export default fp(async function repositoriesPlugin(app: FastifyInstance) {
  const dbPath = getDuckDbPath(getEnv());
  const dbLogger = app.log.child({ name: 'db' });
  const db = await createDb(dbPath, { logger: dbLogger });
  const conn = await db.connect();

  const statisticsRepository = createDuckDbStatisticsRepository(conn);

  app.decorate('dbConn', conn);
  app.decorate('repos', {
    statisticsRepository,
  });

  app.addHook('onClose', () => {
    conn.closeSync();
  });
});
