import { z } from 'zod';

const RootResponse = z.object({
  name: z.string(),
  endpoints: z.array(z.string()),
});

const HealthOkResponse = z
  .object({
    ok: z.literal(true),
    ts: z.string(),
    db: z.literal('up'),
  })
  .meta({
    examples: [{ ok: true, ts: '2026-02-16T11:00:00.000Z', db: 'up' }],
  });

const HealthDownResponse = z
  .object({
    ok: z.literal(false),
    ts: z.string(),
    db: z.literal('down'),
  })
  .meta({
    examples: [{ ok: false, ts: '2026-02-16T11:00:00.000Z', db: 'down' }],
  });

export const rootRouteSchema = {
  schema: {
    tags: ['system'],
    description: 'List discoverable API endpoints',
    response: {
      200: RootResponse,
    },
  },
};

export const healthRouteSchema = {
  schema: {
    tags: ['system'],
    description: 'Service health including database reachability',
    response: {
      200: HealthOkResponse,
      503: HealthDownResponse,
    },
  },
};
