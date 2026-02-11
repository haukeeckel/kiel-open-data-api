import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

import { API_NAME } from '../../config/constants.js';
import { type Env, getEnv } from '../../config/env.js';

import type { FastifyInstance } from 'fastify';

export type SwaggerPluginOptions = { env?: Env };

export default fp<SwaggerPluginOptions>(async function swaggerPlugin(app: FastifyInstance, opts) {
  const env = opts?.env ?? getEnv();
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

  if (env.SWAGGER_UI_ENABLED) {
    await app.register(swaggerUi, {
      routePrefix: env.SWAGGER_ROUTE_PREFIX,
    });
  }
});
