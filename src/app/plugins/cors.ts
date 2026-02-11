import cors from '@fastify/cors';
import fp from 'fastify-plugin';

import { getEnv } from '../../config/env.js';

import type { FastifyInstance } from 'fastify';

export default fp(async function corsPlugin(app: FastifyInstance) {
  const { CORS_ORIGIN } = getEnv();

  await app.register(cors, {
    origin: CORS_ORIGIN,
  });
});
