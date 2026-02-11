import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';

import { getEnv } from '../../config/env.js';

import type { FastifyInstance } from 'fastify';

export default fp(async function helmetPlugin(app: FastifyInstance) {
  const env = getEnv();
  const isProd = env.NODE_ENV === 'production';

  await app.register(helmet, {
    contentSecurityPolicy: isProd,
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true, preload: true } : false,
  });
});
