import type { FastifyInstance } from 'fastify';

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
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              ts: { type: 'string' },
            },
            required: ['ok', 'ts'],
          },
        },
      },
    },
    async () => ({ ok: true, ts: new Date().toISOString() }),
  );
}
