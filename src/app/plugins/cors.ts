import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { getEnv } from '../../config/env';

export default fp(async function corsPlugin(app: FastifyInstance) {
  const { CORS_ORIGIN } = getEnv();

  await app.register(cors, {
    origin: CORS_ORIGIN,
  });
});
