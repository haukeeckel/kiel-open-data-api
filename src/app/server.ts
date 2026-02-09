import Fastify from 'fastify';
import { buildHttpLogger } from './plugins/logging';
import { registerSwagger } from './plugins/swagger';
import { registerHealthRoutes } from './routes/health';
import { registerFactsRoutes } from './routes/facts.route';
import { registerErrorHandlers } from './plugins/errorHandler';
import { getEnv } from '../config/env';
import { registerRepositories } from './plugins/repositories';
import { registerServices } from './plugins/services';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

export async function buildServer() {
  const env = getEnv();
  const app = Fastify({
    logger: buildHttpLogger(env.NODE_ENV),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerErrorHandlers(app);

  await registerSwagger(app);

  await registerRepositories(app);
  await registerServices(app);

  await registerHealthRoutes(app);
  await registerFactsRoutes(app);

  return app;
}

export async function startServer() {
  const env = getEnv();
  const app = await buildServer();

  await app.ready();

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
