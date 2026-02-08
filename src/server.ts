import Fastify from 'fastify';
import { env } from './env';
import { buildHttpLogger } from './app/plugins/logging';
import { registerSwagger } from './app/plugins/swagger';
import { registerHealthRoutes } from './app/routes/health';
import { registerFactsRoutes } from './app/routes/facts.route';
import { registerErrorHandlers } from './app/plugins/errorHandler';
import { registerTestRoutes } from './app/routes/test.routes';
import { registerApiSchemas } from './app/plugins/schemas';

export async function buildServer() {
  const app = Fastify({
    logger: buildHttpLogger(env.NODE_ENV),
  });

  await registerErrorHandlers(app);

  await registerSwagger(app);
  await registerApiSchemas(app);

  await registerHealthRoutes(app);
  await registerFactsRoutes(app);
  if (env.NODE_ENV === 'test') {
    await registerTestRoutes(app);
  }

  await app.ready();
  return app;
}

async function main() {
  const app = await buildServer();

  await app.listen({ port: env.PORT, host: env.HOST });

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
