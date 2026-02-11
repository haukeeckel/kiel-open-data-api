import { describe, expect, it, vi } from 'vitest';

import { sendBadRequest, sendError, sendInternalError, sendNotFound } from './errors.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

function makeReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  return reply as unknown as FastifyReply;
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
    });

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(body.error).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'invalid',
      details: [{ message: 'nope' }],
    });
  });

  it('sendBadRequest defaults to 400 with optional details', () => {
    const req = makeRequest('abc');
    const reply = makeReply();

    sendBadRequest(req, reply, 'bad', { field: 'x' });

    expect(reply.code).toHaveBeenCalledWith(400);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(body).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'bad',
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
