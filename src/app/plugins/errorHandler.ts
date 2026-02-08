import type { FastifyInstance } from 'fastify';
import { sendInternalError, sendNotFound } from '../http/errors';

export async function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request failed');
    return sendInternalError(req, reply);
  });

  app.setNotFoundHandler((req, reply) => {
    return sendNotFound(req, reply);
  });
}
