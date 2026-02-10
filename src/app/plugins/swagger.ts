import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import { getEnv } from '../../config/env.js';

export default fp(async function swaggerPlugin(app: FastifyInstance) {
  const env = getEnv();
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'kiel-dashboard-api',
        description: 'Open data API for Kiel dashboard',
        version: env.APP_VERSION,
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
});
