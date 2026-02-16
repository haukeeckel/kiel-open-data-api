import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import {
  toAreasQuery,
  toCategoriesQuery,
  toIndicatorsQuery,
  toRankingQuery,
  toTimeseriesQuery,
  toYearsQuery,
} from '../mappers/statistics.mapper.js';

import {
  areaTypesRouteSchema,
  areasRouteSchema,
  capabilitiesRouteSchema,
  categoriesRouteSchema,
  indicatorMetaRouteSchema,
  indicatorsRouteSchema,
  rankingRouteSchema,
  timeseriesRouteSchema,
  yearMetaRouteSchema,
  yearsRouteSchema,
} from './statistics.schema.js';

import type { FastifyInstance } from 'fastify';

export default async function statisticsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/area-types', areaTypesRouteSchema, async () => {
    return app.services.statisticsQuery.listAreaTypes();
  });

  r.get('/capabilities', capabilitiesRouteSchema, async () => {
    return app.services.statisticsQuery.getCapabilities();
  });

  r.get('/indicators', indicatorsRouteSchema, async (req) => {
    return app.services.statisticsQuery.listIndicators(toIndicatorsQuery(req.query));
  });

  r.get('/indicators/:indicator', indicatorMetaRouteSchema, async (req) => {
    return app.services.statisticsQuery.getIndicatorMeta(req.params.indicator);
  });

  r.get('/years', yearsRouteSchema, async (req) => {
    return app.services.statisticsQuery.listYears(toYearsQuery(req.query));
  });

  r.get('/years/:year', yearMetaRouteSchema, async (req) => {
    return app.services.statisticsQuery.getYearMeta(req.params.year);
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
