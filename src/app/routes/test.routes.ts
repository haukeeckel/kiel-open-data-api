import { type FastifyInstance } from 'fastify';

export async function registerTestRoutes(app: FastifyInstance) {
  app.get('/__boom', async () => {
    throw new Error('boom');
  });
}
