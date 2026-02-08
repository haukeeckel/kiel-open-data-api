import type { FastifyReply, FastifyRequest } from 'fastify';
import z from 'zod';

export type InvalidQueryResponse = {
  error: 'Invalid query parameters';
  details: unknown; // strukturiert (flatten/treeify)
};

export function badQuery(
  req: FastifyRequest,
  reply: FastifyReply,
  error: z.ZodError,
): FastifyReply {
  const details = z.treeifyError(error);

  req.log.debug({ details, query: req.query }, 'invalid query parameters');

  return reply.code(400).send({
    error: 'Invalid query parameters',
    details,
  } satisfies InvalidQueryResponse);
}
