import type { ErrorDetails } from '../../types/errors.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type { ErrorDetails };

export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'TOO_MANY_REQUESTS',
  'CLIENT_ERROR',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type DomainValidationDetails = {
  kind: 'domain_validation';
  field: 'indicator' | 'areaType' | 'category';
  value: string;
  allowed: string[];
};

export type RateLimitDetails = {
  kind: 'rate_limit';
  retryAfterMs?: number;
};

export type ApiKnownDetails = DomainValidationDetails | RateLimitDetails | ErrorDetails;

export type ApiErrorInput = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: ApiKnownDetails;
};

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiKnownDetails;
  };
  requestId: string;
};

function requestId(req: FastifyRequest): string {
  return req.id;
}

export function sendError(req: FastifyRequest, reply: FastifyReply, input: ApiErrorInput) {
  const body: ApiErrorBody = {
    error: {
      code: input.code,
      message: input.message,
      ...(input.details !== undefined ? { details: input.details } : {}),
    },
    requestId: requestId(req),
  };

  return reply.code(input.statusCode).send(body);
}

export function sendBadRequest(
  req: FastifyRequest,
  reply: FastifyReply,
  message: string,
  details?: ApiKnownDetails,
) {
  return sendError(req, reply, {
    statusCode: 400,
    code: 'BAD_REQUEST',
    message,
    ...(details !== undefined ? { details } : {}),
  });
}

export function sendNotFound(req: FastifyRequest, reply: FastifyReply, message = 'Not Found') {
  return sendError(req, reply, {
    statusCode: 404,
    code: 'NOT_FOUND',
    message,
  });
}

export function sendInternalError(
  req: FastifyRequest,
  reply: FastifyReply,
  message = 'Internal Server Error',
) {
  return sendError(req, reply, {
    statusCode: 500,
    code: 'INTERNAL',
    message,
  });
}
