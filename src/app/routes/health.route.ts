import type { FastifyInstance } from 'fastify';
import z from 'zod';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiError } from '../../schemas/api';

const RootResponse = z.object({
  name: z.string(),
  endpoints: z.array(z.string()),
});

const HealthResponse = z.object({
  ok: z.boolean(),
  ts: z.string(),
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
      endpoints: ['/health'],
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
    async () => ({ ok: true, ts: new Date().toISOString() }),
  );
}
