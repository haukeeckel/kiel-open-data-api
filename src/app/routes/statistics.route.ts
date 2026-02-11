import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import { toAreasQuery, toRankingQuery, toTimeseriesQuery } from '../mappers/statistics.mapper.js';

import {
  areasRouteSchema,
  rankingRouteSchema,
  timeseriesRouteSchema,
} from './statistics.schema.js';

import type { FastifyInstance } from 'fastify';

export default async function statisticsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/areas', areasRouteSchema, async (req) => {
    return app.services.statisticsQuery.listAreas(toAreasQuery(req.query));
  });

  r.get('/timeseries', timeseriesRouteSchema, async (req) => {
    return app.services.statisticsQuery.getTimeseries(toTimeseriesQuery(req.query));
  });

  r.get('/ranking', rankingRouteSchema, async (req) => {
    return app.services.statisticsQuery.getRanking(toRankingQuery(req.query));
  });
}
