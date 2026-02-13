import fp from 'fastify-plugin';

import { metricsRegistry, recordHttpRequest } from '../../observability/metrics.js';

import type { FastifyInstance } from 'fastify';

const requestStartNs = new WeakMap<object, bigint>();

export default fp(async function metricsPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    requestStartNs.set(req, process.hrtime.bigint());
  });

  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions.url ?? '<unknown>';
    if (route === '/metrics') return;

    const startedAt = requestStartNs.get(req);
    if (!startedAt) return;

    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    recordHttpRequest(req.method, route, reply.statusCode, durationSeconds);
  });

  app.get(
    '/metrics',
    {
      schema: {
        hide: true,
      },
    },
    async (_req, reply) => {
      reply.header('content-type', metricsRegistry.contentType);
      return reply.send(await metricsRegistry.metrics());
    },
  );
});
