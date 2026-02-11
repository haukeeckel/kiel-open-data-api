import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';

import { type Env, getEnv } from '../../config/env.js';

import type { FastifyInstance } from 'fastify';

export type HelmetPluginOptions = { env?: Env };

export default fp<HelmetPluginOptions>(async function helmetPlugin(app: FastifyInstance, opts) {
  const env = opts?.env ?? getEnv();
  const isProd = env.NODE_ENV === 'production';

  await app.register(helmet, {
    contentSecurityPolicy: isProd,
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true, preload: true } : false,
  });
});
