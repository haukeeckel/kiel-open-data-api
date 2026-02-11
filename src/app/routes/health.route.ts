import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { API_NAME } from '../../config/constants.js';
import { getEnv } from '../../config/env.js';

const RootResponse = z.object({
  name: z.string(),
  endpoints: z.array(z.string()),
});

const HealthResponse = z.object({
  ok: z.boolean(),
  ts: z.string(),
  db: z.enum(['up', 'down']),
});

export default async function healthRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      schema: {
        response: {
          200: RootResponse,
        },
      },
    },
    async (req) => {
      const docsPrefix = getEnv().SWAGGER_ROUTE_PREFIX;
      const apiPaths = Object.keys(req.server.swagger().paths ?? {}).filter((p) => p !== '/');
      return {
        name: API_NAME,
        endpoints: [...apiPaths, docsPrefix, `${docsPrefix}/json`].sort(),
      };
    },
  );

  r.get(
    '/health',
    {
      schema: {
        response: {
          200: HealthResponse,
          503: HealthResponse,
        },
      },
    },
    async (req, reply) => {
      const ts = new Date().toISOString();
      try {
        await req.server.dbConn.run('SELECT 1');
      } catch (err) {
        req.log.warn({ err }, 'health-check: db unreachable');
        return reply.code(503).send({ ok: false, ts, db: 'down' as const });
      }
      return { ok: true, ts, db: 'up' as const };
    },
  );
}
