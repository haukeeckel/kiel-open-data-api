import Fastify from 'fastify';
import { env } from './env';
import { getDb } from './db';

export function buildServer() {
  const isProd = process.env.NODE_ENV === 'production';

  const app = Fastify({
    logger: isProd
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        },
  });

  app.get('/', async () => {
    return {
      name: 'kiel-dashboard-api',
      endpoints: ['/health'],
    };
  });

  app.get('/health', async () => {
    return { ok: true, ts: new Date().toISOString() };
  });

  app.get('/db-test', async () => {
    const db = await getDb();
    const conn = await db.connect();

    try {
      const reader = await conn.runAndReadAll('SELECT 42 AS answer');
      return { rows: reader.getRowObjects() };
    } finally {
      conn.disconnectSync();
    }
  });

  app.setNotFoundHandler(async (_req, reply) => {
    return reply.code(404).send({ error: 'Not Found' });
  });

  return app;
}

async function main() {
  const app = buildServer();

  const port = env.PORT;
  const host = env.HOST;

  await app.listen({ port, host });

  const close = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');

    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void close('SIGINT'));
  process.on('SIGTERM', () => void close('SIGTERM'));
}

void main();
