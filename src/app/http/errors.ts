import type { FastifyReply, FastifyRequest } from 'fastify';

export type ApiErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'INTERNAL';

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

function requestId(req: FastifyRequest): string {
  // Fastify sets req.id; fallback just in case
  return String((req as { id?: unknown }).id ?? 'unknown');
}

export function sendBadRequest(
  req: FastifyRequest,
  reply: FastifyReply,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: { code: 'BAD_REQUEST', message, ...(details ? { details } : {}) },
    requestId: requestId(req),
  };

  return reply.code(400).send(body);
}

export function sendNotFound(req: FastifyRequest, reply: FastifyReply, message = 'Not Found') {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message },
    requestId: requestId(req),
  };

  return reply.code(404).send(body);
}

export function sendInternalError(
  req: FastifyRequest,
  reply: FastifyReply,
  message = 'Internal Server Error',
) {
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL', message },
    requestId: requestId(req),
  };

  return reply.code(500).send(body);
}
