import type { FastifyInstance } from 'fastify';
import z from 'zod';
import { ApiError } from '../../schemas/api';

const HealthResponse = z.object({
  ok: z.boolean(),
  ts: z.string(),
});

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return {
      name: 'kiel-dashboard-api',
      endpoints: ['/health'],
    };
  });

  app.get(
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
