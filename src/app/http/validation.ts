import type { FastifyReply, FastifyRequest } from 'fastify';
import z from 'zod';
import { sendBadRequest } from './errors';

export type InvalidQueryResponse = {
  error: 'Invalid query parameters';
  details: unknown; // strukturiert (flatten/treeify)
};

export function badQuery(
  req: FastifyRequest,
  reply: FastifyReply,
  error: z.ZodError,
): FastifyReply {
  req.log.debug({ details: z.treeifyError(error) }, 'invalid query parameters');
  return sendBadRequest(req, reply, 'Invalid query parameters', z.treeifyError(error));
}
