import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { getEnv } from '../config/env.js';
import { getLoggerOptions } from '../logger/http.js';

import corsPlugin from './plugins/cors.js';
import errorHandlerPlugin from './plugins/errorHandler.js';
import helmetPlugin from './plugins/helmet.js';
import rateLimitPlugin from './plugins/rateLimit.js';
import repositoriesPlugin from './plugins/repositories.js';
import servicesPlugin from './plugins/services.js';
import swaggerPlugin from './plugins/swagger.js';
import healthRoutes from './routes/health.route.js';
import statisticsRoutes from './routes/statistics.route.js';

export async function buildServer() {
  const env = getEnv();
  const app = Fastify({
    logger: getLoggerOptions(env.NODE_ENV),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // plugins (shared scope via fp())
  await app.register(corsPlugin);
  await app.register(helmetPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(swaggerPlugin);
  await app.register(rateLimitPlugin);
  await app.register(repositoriesPlugin);
  await app.register(servicesPlugin);

  // routes (encapsulated)
  await app.register(healthRoutes);
  await app.register(statisticsRoutes, { prefix: '/v1' });

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
