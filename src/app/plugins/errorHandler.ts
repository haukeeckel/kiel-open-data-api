import fp from 'fastify-plugin';

import { StatisticsNotFoundError } from '../../domains/statistics/errors/statisticsNotFoundError.js';
import { StatisticsValidationError } from '../../domains/statistics/errors/statisticsValidationError.js';
import {
  type ApiErrorCode,
  type ApiErrorReason,
  type ErrorDetails,
  type RateLimitDetails,
  sendBadRequest,
  sendError,
  sendInternalError,
  sendNotFound,
} from '../http/errors.js';

import type { FastifyInstance } from 'fastify';

type ErrorWithStatus = { statusCode?: number };
type ErrorWithValidation = { validation?: ErrorDetails };
type DomainField = 'indicator' | 'areaType' | 'category';
type DomainValidationDetailsLike = {
  kind: 'domain_validation';
  field: DomainField;
  allowed?: unknown;
};

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
    case 429:
      return 'TOO_MANY_REQUESTS' as const;
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
    case 429:
      return 'Too Many Requests';
    default:
      return 'Bad Request';
  }
}

function getRateLimitDetails(err: unknown): RateLimitDetails | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  if (!('statusCode' in err) || (err as { statusCode?: unknown }).statusCode !== 429) {
    return undefined;
  }
  const retryAfterMs =
    'ttl' in err && typeof (err as { ttl?: unknown }).ttl === 'number'
      ? (err as { ttl: number }).ttl
      : undefined;
  const retryAfterSec =
    retryAfterMs !== undefined ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : undefined;

  return {
    kind: 'rate_limit',
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    ...(retryAfterSec !== undefined ? { retryAfterSec } : {}),
  };
}

function isDomainValidationDetails(details: unknown): details is DomainValidationDetailsLike {
  if (typeof details !== 'object' || details === null) return false;
  const kind = (details as { kind?: unknown }).kind;
  const field = (details as { field?: unknown }).field;
  return (
    kind === 'domain_validation' &&
    (field === 'indicator' || field === 'areaType' || field === 'category')
  );
}

function reasonFromDomainValidation(err: StatisticsValidationError): ApiErrorReason {
  if (err.message === 'from must be <= to') {
    return 'INVALID_RANGE';
  }

  if (isDomainValidationDetails(err.details)) {
    switch (err.details.field) {
      case 'indicator':
        return 'UNKNOWN_INDICATOR';
      case 'areaType':
        return 'UNKNOWN_AREA_TYPE';
      case 'category':
        return 'UNKNOWN_CATEGORY';
    }
  }

  return 'INVALID_QUERY_PARAMS';
}

function suggestionsFromDomainValidation(err: StatisticsValidationError): string[] | undefined {
  if (!isDomainValidationDetails(err.details)) return undefined;
  const allowed = err.details.allowed;
  if (!Array.isArray(allowed)) return undefined;
  const suggestions = allowed.filter((value): value is string => typeof value === 'string');
  if (suggestions.length === 0) return undefined;
  return suggestions.slice(0, 5);
}

export default fp(async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    // 1) Domain validation => 400
    if (err instanceof StatisticsValidationError) {
      req.log.debug({ err }, 'domain validation failed');
      const suggestions = suggestionsFromDomainValidation(err);
      return sendBadRequest(req, reply, err.message, err.details, {
        reason: reasonFromDomainValidation(err),
        ...(suggestions !== undefined ? { suggestions } : {}),
      });
    }

    // 1b) Domain not found => 404
    if (err instanceof StatisticsNotFoundError) {
      req.log.debug({ err }, 'domain entity not found');
      return sendNotFound(req, reply, err.message);
    }

    const status = getStatusCode(err);

    // 2) Fastify request validation => 400
    if (status === 400 && hasValidation(err) && err.validation) {
      req.log.debug({ err }, 'request validation failed');
      return sendBadRequest(req, reply, 'Invalid query parameters', err.validation, {
        reason: 'INVALID_QUERY_PARAMS',
      });
    }

    // 3) Other 4xx: preserve status + map to API code
    if (status !== undefined && status >= 400 && status < 500) {
      req.log.debug({ err, status }, 'client error');
      const message =
        err instanceof Error && err.message ? err.message : defaultMessageForStatus(status);
      const details = getRateLimitDetails(err);
      if (status === 429 && details?.retryAfterSec !== undefined) {
        reply.header('Retry-After', String(details.retryAfterSec));
      }

      return sendError(req, reply, {
        statusCode: status,
        code: statusToApiCode(status),
        message,
        ...(details !== undefined ? { details } : {}),
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
