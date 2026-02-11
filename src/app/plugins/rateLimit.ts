import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

import { type Env, getEnv } from '../../config/env.js';

import type { FastifyInstance } from 'fastify';

export type RateLimitPluginOptions = { env?: Env };

export default fp<RateLimitPluginOptions>(async function rateLimitPlugin(
  app: FastifyInstance,
  opts,
) {
  const env = opts?.env ?? getEnv();
  if (env.NODE_ENV === 'test') return;

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });
});
