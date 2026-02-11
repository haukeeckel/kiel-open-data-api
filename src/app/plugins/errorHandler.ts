import fp from 'fastify-plugin';

import { StatisticsValidationError } from '../../domains/statistics/errors/statisticsValidationError.js';
import {
  type ApiErrorCode,
  type ErrorDetails,
  sendBadRequest,
  sendError,
  sendInternalError,
  sendNotFound,
} from '../http/errors.js';

import type { FastifyInstance } from 'fastify';

type ErrorWithStatus = { statusCode?: number };
type ErrorWithValidation = { validation?: ErrorDetails };

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

function statusToApiCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'BAD_REQUEST' as const;
    case 401:
      return 'UNAUTHORIZED' as const;
    case 403:
      return 'FORBIDDEN' as const;
    case 409:
      return 'CONFLICT' as const;
    case 422:
      return 'UNPROCESSABLE_ENTITY' as const;
    default:
      return 'CLIENT_ERROR' as const;
  }
}

function defaultMessageForStatus(status: number) {
  switch (status) {
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 409:
      return 'Conflict';
    case 422:
      return 'Unprocessable Entity';
    default:
      return 'Bad Request';
  }
}

export default fp(async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    // 1) Domain validation => 400
    if (err instanceof StatisticsValidationError) {
      req.log.debug({ err }, 'domain validation failed');
      return sendBadRequest(req, reply, err.message, err.details);
    }

    const status = getStatusCode(err);

    // 2) Fastify request validation => 400
    if (status === 400 && hasValidation(err) && err.validation) {
      req.log.debug({ err }, 'request validation failed');
      return sendBadRequest(req, reply, 'Invalid query parameters', err.validation);
    }

    // 3) Other 4xx: preserve status + map to API code
    if (status !== undefined && status >= 400 && status < 500) {
      req.log.debug({ err, status }, 'client error');
      const message =
        err instanceof Error && err.message ? err.message : defaultMessageForStatus(status);

      return sendError(req, reply, {
        statusCode: status,
        code: statusToApiCode(status),
        message,
      });
    }

    // 4) Default 500
    req.log.error({ err }, 'request failed');
    return sendInternalError(req, reply);
  });

  app.setNotFoundHandler((req, reply) => {
    return sendNotFound(req, reply);
  });
});
