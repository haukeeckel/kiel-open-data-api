import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { getEnv } from '../../config/env';
import { getDuckDbPath } from '../../config/path';
import { createDb } from '../../infra/db/duckdb';
import { createDuckDbStatisticsRepository } from '../../infra/db/statisticsRepository.duckdb';

export default fp(async function repositoriesPlugin(app: FastifyInstance) {
  const dbPath = getDuckDbPath(getEnv());
  const db = await createDb(dbPath);
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
