import type { FastifyInstance } from 'fastify';
import z from 'zod';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiError } from '../../schemas/api.js';

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
    async () => ({
      name: 'kiel-dashboard-api',
      endpoints: ['/health', '/docs', '/docs/json', '/v1/timeseries', '/v1/areas', '/v1/ranking'],
    }),
  );

  r.get(
    '/health',
    {
      schema: {
        response: {
          200: HealthResponse,
          500: ApiError,
        },
      },
    },
    async (req) => {
      let db: 'up' | 'down' = 'down';
      try {
        await req.server.dbConn.run('SELECT 1');
        db = 'up';
      } catch {
        // db stays 'down'
      }
      return { ok: db === 'up', ts: new Date().toISOString(), db };
    },
  );
}
