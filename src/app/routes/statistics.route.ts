import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  areasRouteSchema,
  rankingRouteSchema,
  timeseriesRouteSchema,
} from './statistics.schema.js';
import { toAreasQuery, toRankingQuery, toTimeseriesQuery } from '../mappers/statistics.mapper.js';

export default async function statisticsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/timeseries', timeseriesRouteSchema, async (req) => {
    return app.services.statisticsQuery.getTimeseries(toTimeseriesQuery(req.query));
  });

  r.get('/areas', areasRouteSchema, async (req) => {
    return app.services.statisticsQuery.listAreas(toAreasQuery(req.query));
  });

  r.get('/ranking', rankingRouteSchema, async (req) => {
    return app.services.statisticsQuery.getRanking(toRankingQuery(req.query));
  });
}
