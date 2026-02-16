import { describe, expect, it, vi } from 'vitest';

import { sendBadRequest, sendError, sendInternalError, sendNotFound } from './errors.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

type ReplyMock = {
  code: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

function makeReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  return reply as ReplyMock & FastifyReply;
}

function makeRequest(id = 'req-1') {
  return { id } as FastifyRequest;
}

describe('http errors', () => {
  it('sendError writes status, body, and request id', () => {
    const req = makeRequest('abc');
    const reply = makeReply();

    sendError(req, reply, {
      statusCode: 418,
      code: 'CLIENT_ERROR',
      message: 'nope',
    });

    expect(reply.code).toHaveBeenCalledWith(418);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'CLIENT_ERROR',
        message: 'nope',
      },
      requestId: 'abc',
    });
  });

  it('sendError includes details when provided', () => {
    const req = makeRequest('abc');
    const reply = makeReply();

    sendError(req, reply, {
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'invalid',
      details: [{ message: 'nope' }],
      reason: 'INVALID_QUERY_PARAMS',
      suggestions: ['population'],
    });

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(body.error).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'invalid',
      reason: 'INVALID_QUERY_PARAMS',
      suggestions: ['population'],
      details: [{ message: 'nope' }],
    });
  });

  it('sendError supports too many requests code', () => {
    const req = makeRequest('abc');
    const reply = makeReply();

    sendError(req, reply, {
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too Many Requests',
      details: { kind: 'rate_limit', retryAfterMs: 1000, retryAfterSec: 1 },
    });

    expect(reply.code).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too Many Requests',
        details: { kind: 'rate_limit', retryAfterMs: 1000, retryAfterSec: 1 },
      },
      requestId: 'abc',
    });
  });

  it('sendBadRequest defaults to 400 with optional details', () => {
    const req = makeRequest('abc');
    const reply = makeReply();

    sendBadRequest(req, reply, 'bad', { field: 'x' }, { reason: 'INVALID_QUERY_PARAMS' });

    expect(reply.code).toHaveBeenCalledWith(400);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(body).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'bad',
        reason: 'INVALID_QUERY_PARAMS',
        details: { field: 'x' },
      },
      requestId: 'abc',
    });
  });

  it('sendNotFound defaults message and status', () => {
    const req = makeRequest('abc');
    const reply = makeReply();

    sendNotFound(req, reply);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Not Found',
      },
      requestId: 'abc',
    });
  });

  it('sendInternalError defaults message and status', () => {
    const req = makeRequest('abc');
    const reply = makeReply();

    sendInternalError(req, reply);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL',
        message: 'Internal Server Error',
      },
      requestId: 'abc',
    });
  });
});
