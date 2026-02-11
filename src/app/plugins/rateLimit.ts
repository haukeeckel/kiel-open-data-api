import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

import { getEnv } from '../../config/env.js';

import type { FastifyInstance } from 'fastify';

export default fp(async function rateLimitPlugin(app: FastifyInstance) {
  const env = getEnv();
  if (env.NODE_ENV === 'test') return;

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });
});
