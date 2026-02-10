import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { getEnv } from '../config/env';
import { getLoggerOptions } from '../logger/http';
import corsPlugin from './plugins/cors';
import errorHandlerPlugin from './plugins/errorHandler';
import swaggerPlugin from './plugins/swagger';
import repositoriesPlugin from './plugins/repositories';
import servicesPlugin from './plugins/services';
import healthRoutes from './routes/health.route';
import statisticsRoutes from './routes/statistics.route';

export async function buildServer() {
  const env = getEnv();
  const app = Fastify({
    logger: getLoggerOptions(env.NODE_ENV),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // plugins (shared scope via fp())
  await app.register(corsPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(swaggerPlugin);
  await app.register(repositoriesPlugin);
  await app.register(servicesPlugin);

  // routes (encapsulated)
  await app.register(healthRoutes);
  await app.register(statisticsRoutes);

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
