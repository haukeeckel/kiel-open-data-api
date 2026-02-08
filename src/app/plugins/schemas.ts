import type { FastifyInstance } from 'fastify';
import { ApiErrorSchema } from './openapiSchemas';

export async function registerApiSchemas(app: FastifyInstance) {
  app.addSchema(ApiErrorSchema);
}
