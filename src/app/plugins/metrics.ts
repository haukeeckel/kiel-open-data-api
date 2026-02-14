import fp from 'fastify-plugin';

import { type Env, getEnv } from '../../config/env.js';
import { metricsRegistry, recordHttpRequest } from '../../observability/metrics.js';
import { sendError } from '../http/errors.js';

import type { FastifyInstance } from 'fastify';

const requestStartNs = new WeakMap<object, bigint>();

export type MetricsPluginOptions = { env?: Env };

export default fp<MetricsPluginOptions>(async function metricsPlugin(app: FastifyInstance, opts) {
  const env = opts?.env ?? getEnv();

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

  if (!env.METRICS_ENABLED) {
    return;
  }

  app.get(
    '/metrics',
    {
      schema: {
        hide: true,
      },
    },
    async (req, reply) => {
      if (env.METRICS_TOKEN) {
        const headerName = env.METRICS_AUTH_HEADER.toLowerCase();
        const tokenHeader = req.headers[headerName];
        const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
        if (!token) {
          return sendError(req, reply, {
            statusCode: 401,
            code: 'UNAUTHORIZED',
            message: 'Missing metrics authentication token',
          });
        }
        if (token !== env.METRICS_TOKEN) {
          return sendError(req, reply, {
            statusCode: 403,
            code: 'FORBIDDEN',
            message: 'Invalid metrics authentication token',
          });
        }
      }
      reply.header('content-type', metricsRegistry.contentType);
      return reply.send(await metricsRegistry.metrics());
    },
  );
});
