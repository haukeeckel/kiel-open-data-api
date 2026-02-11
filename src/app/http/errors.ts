import type { ErrorDetails } from '../../types/errors.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type { ErrorDetails };

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'CLIENT_ERROR'
  | 'INTERNAL';

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ErrorDetails;
  };
  requestId: string;
};

function requestId(req: FastifyRequest): string {
  return req.id;
}

export function sendError(
  req: FastifyRequest,
  reply: FastifyReply,
  input: { statusCode: number; code: ApiErrorCode; message: string; details?: ErrorDetails },
) {
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
  details?: ErrorDetails,
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
