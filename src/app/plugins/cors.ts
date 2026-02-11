import cors from '@fastify/cors';
import fp from 'fastify-plugin';

import { type Env, getEnv } from '../../config/env.js';

import type { FastifyInstance } from 'fastify';

export type CorsPluginOptions = { env?: Env };

export default fp<CorsPluginOptions>(async function corsPlugin(app: FastifyInstance, opts) {
  const { CORS_ORIGIN } = opts?.env ?? getEnv();

  await app.register(cors, {
    origin: CORS_ORIGIN,
  });
});
