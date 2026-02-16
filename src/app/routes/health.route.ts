import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import { API_NAME } from '../../config/constants.js';
import { getEnv } from '../../config/env.js';

import { healthRouteSchema, rootRouteSchema } from './health.schema.js';

import type { FastifyInstance } from 'fastify';

export default async function healthRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const env = getEnv();
  const docsPrefix = env.SWAGGER_ROUTE_PREFIX;
  let cachedEndpoints: string[] = [];

  const buildEndpoints = () => {
    const apiPaths = Object.keys(app.swagger().paths ?? {}).filter((p) => p !== '/');
    const docsPaths = env.SWAGGER_UI_ENABLED ? [docsPrefix, `${docsPrefix}/json`] : [];
    return [...apiPaths, ...docsPaths].sort();
  };

  app.addHook('onReady', async () => {
    cachedEndpoints = buildEndpoints();
  });

  r.get('/', rootRouteSchema, async () => {
    if (cachedEndpoints.length === 0) {
      cachedEndpoints = buildEndpoints();
    }
    return {
      name: API_NAME,
      endpoints: cachedEndpoints,
    };
  });

  r.get('/health', healthRouteSchema, async (req, reply) => {
    const ts = new Date().toISOString();
    const dbUp = await req.server.dbManager.healthcheck();
    if (!dbUp) {
      req.log.warn('health-check: db unreachable');
      return reply.code(503).send({ ok: false as const, ts, db: 'down' as const });
    }
    return { ok: true as const, ts, db: 'up' as const };
  });
}
