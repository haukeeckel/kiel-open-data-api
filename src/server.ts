import Fastify from 'fastify';

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

  app.setNotFoundHandler(async (_req, reply) => {
    return reply.code(404).send({ error: 'Not Found' });
  });

  return app;
}

async function main() {
  const app = buildServer();

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';

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
