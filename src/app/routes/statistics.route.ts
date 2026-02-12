import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import {
  toAreasQuery,
  toCategoriesQuery,
  toRankingQuery,
  toTimeseriesQuery,
} from '../mappers/statistics.mapper.js';

import {
  areaTypesRouteSchema,
  areasRouteSchema,
  categoriesRouteSchema,
  indicatorsRouteSchema,
  rankingRouteSchema,
  timeseriesRouteSchema,
} from './statistics.schema.js';

import type { FastifyInstance } from 'fastify';

export default async function statisticsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/area-types', areaTypesRouteSchema, async () => {
    return app.services.statisticsQuery.listAreaTypes();
  });

  r.get('/indicators', indicatorsRouteSchema, async () => {
    return app.services.statisticsQuery.listIndicators();
  });

  r.get('/areas', areasRouteSchema, async (req) => {
    return app.services.statisticsQuery.listAreas(toAreasQuery(req.query));
  });

  r.get('/categories', categoriesRouteSchema, async (req) => {
    return app.services.statisticsQuery.listCategories(toCategoriesQuery(req.query));
  });

  r.get('/ranking', rankingRouteSchema, async (req) => {
    return app.services.statisticsQuery.getRanking(toRankingQuery(req.query));
  });

  r.get('/timeseries', timeseriesRouteSchema, async (req) => {
    return app.services.statisticsQuery.getTimeseries(toTimeseriesQuery(req.query));
  });
}
