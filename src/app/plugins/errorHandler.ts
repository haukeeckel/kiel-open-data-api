import type { FastifyInstance } from 'fastify';
import { sendBadRequest, sendInternalError, sendNotFound } from '../http/errors';
import { StatisticsValidationError } from '../../domains/statistics/errors/statisticsValidationError';

type ErrorWithStatus = { statusCode?: number };
type ErrorWithValidation = { validation?: unknown };

function hasStatusCode(err: unknown): err is ErrorWithStatus {
  return typeof err === 'object' && err !== null && 'statusCode' in err;
}

function hasValidation(err: unknown): err is ErrorWithValidation {
  return typeof err === 'object' && err !== null && 'validation' in err;
}

function getStatusCode(err: unknown): number | undefined {
  if (!hasStatusCode(err)) return undefined;
  return typeof err.statusCode === 'number' ? err.statusCode : undefined;
}

export async function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    // 1) Domain validation
    if (err instanceof StatisticsValidationError) {
      req.log.debug({ err }, 'domain validation failed');
      return sendBadRequest(req, reply, err.message, err.details);
    }

    // 2) Fastify request validation
    const status = getStatusCode(err);
    if (status === 400 && hasValidation(err) && err.validation) {
      req.log.debug({ err }, 'request validation failed');
      return sendBadRequest(req, reply, 'Invalid query parameters', err.validation);
    }

    if (status === 404) {
      return sendNotFound(req, reply);
    }

    // 3) Other 4xx errors
    if (status !== undefined && status >= 400 && status < 500) {
      req.log.debug({ err }, 'client error');
      const message = err instanceof Error ? err.message : 'Bad Request';
      return sendBadRequest(req, reply, message);
    }

    // 4) Default 500
    req.log.error({ err }, 'request failed');
    return sendInternalError(req, reply);
  });

  app.setNotFoundHandler((req, reply) => {
    return sendNotFound(req, reply);
  });
}
