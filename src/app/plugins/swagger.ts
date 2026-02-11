import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

import { API_NAME } from '../../config/constants.js';
import { getEnv } from '../../config/env.js';

import type { FastifyInstance } from 'fastify';

export default fp(async function swaggerPlugin(app: FastifyInstance) {
  const env = getEnv();
  await app.register(swagger, {
    openapi: {
      info: {
        title: API_NAME,
        description: 'Open data API for Kiel dashboard',
        version: env.APP_VERSION,
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: env.SWAGGER_ROUTE_PREFIX,
  });
});
