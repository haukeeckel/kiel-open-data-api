import type { FastifyInstance } from 'fastify';

import { badQuery } from '../http/validation';
import { sendBadRequest } from '../http/errors';
import { AreasQuery, RankingQuery, TimeseriesQuery } from '../../schemas/facts';
import { areasRouteSchema, rankingRouteSchema, timeseriesRouteSchema } from './facts.schema';

export async function registerFactsRoutes(app: FastifyInstance) {
  app.get('/timeseries', timeseriesRouteSchema, async (req, reply) => {
    const parsed = TimeseriesQuery.safeParse(req.query);
    if (!parsed.success) return badQuery(req, reply, parsed.error);

    const { indicator, areaType, area, from, to } = parsed.data;

    const input: { indicator: string; areaType: string; area: string; from?: number; to?: number } =
      {
        indicator,
        areaType,
        area,
      };

    if (!indicator || !areaType || !area) {
      return sendBadRequest(req, reply, 'indicator, areaType and area are required');
    }

    if (from !== undefined) input.from = from;
    if (to !== undefined) input.to = to;

    return app.services.statisticsQuery.getTimeseries(input);
  });

  app.get('/areas', areasRouteSchema, async (req, reply) => {
    const parsed = AreasQuery.safeParse(req.query);
    if (!parsed.success) return badQuery(req, reply, parsed.error);

    const { indicator, areaType, like } = parsed.data;

    const input: { indicator: string; areaType: string; like?: string } = {
      indicator,
      areaType,
    };

    if (!indicator || !areaType) {
      return sendBadRequest(req, reply, 'indicator and areaType are required');
    }

    if (like !== undefined) input.like = like;

    return app.services.statisticsQuery.listAreas(input);
  });

  app.get('/ranking', rankingRouteSchema, async (req, reply) => {
    const parsed = RankingQuery.safeParse(req.query);
    if (!parsed.success) return badQuery(req, reply, parsed.error);

    const { indicator, areaType, year, limit, order } = parsed.data;

    if (!indicator || !areaType || !Number.isFinite(year)) {
      return sendBadRequest(req, reply, 'indicator, areaType and year are required');
    }

    return app.services.statisticsQuery.getRanking({
      indicator,
      areaType,
      year,
      limit,
      order,
    });
  });
}
