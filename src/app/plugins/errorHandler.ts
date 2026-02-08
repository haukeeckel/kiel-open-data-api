import type { FastifyInstance } from 'fastify';
import { sendBadRequest, sendInternalError, sendNotFound } from '../http/errors';

type ErrorWithStatus = { statusCode?: number };
type ErrorWithValidation = { validation?: unknown };

function hasStatusCode(err: unknown): err is ErrorWithStatus {
  return typeof err === 'object' && err !== null && 'statusCode' in err;
}

function hasValidation(err: unknown): err is ErrorWithValidation {
  return typeof err === 'object' && err !== null && 'validation' in err;
}

export async function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    // Fastify validation errors (schema.querystring, params, body, etc.)
    if (hasStatusCode(err) && err.statusCode === 400 && hasValidation(err) && err.validation) {
      req.log.debug({ err }, 'request validation failed');
      return sendBadRequest(req, reply, 'Invalid query parameters', err.validation);
    }

    // TODO: andere 4xx nicht als 500 behandeln
    if (
      hasStatusCode(err) &&
      typeof err.statusCode === 'number' &&
      err.statusCode >= 400 &&
      err.statusCode < 500
    ) {
      req.log.debug({ err }, 'client error');
      return sendBadRequest(req, reply, err instanceof Error ? err.message : 'Bad Request');
    }

    req.log.error({ err }, 'request failed');
    return sendInternalError(req, reply);
  });

  app.setNotFoundHandler((req, reply) => {
    return sendNotFound(req, reply);
  });
}
