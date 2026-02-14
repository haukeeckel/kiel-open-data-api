import { z } from 'zod';

const RootResponse = z.object({
  name: z.string(),
  endpoints: z.array(z.string()),
});

const HealthResponse = z.object({
  ok: z.boolean(),
  ts: z.string(),
  db: z.enum(['up', 'down']),
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
      200: HealthResponse,
      503: HealthResponse,
    },
  },
};
