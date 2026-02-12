import type {
  TimeseriesQuery,
  AreasQuery,
  RankingQuery,
} from '../../domains/statistics/model/types.js';
import type {
  TimeseriesQuery as TimeseriesSchema,
  AreasQuery as AreasSchema,
  RankingQuery as RankingSchema,
} from '../../schemas/statistics.js';
import type { z } from 'zod';

export function toTimeseriesQuery(query: z.infer<typeof TimeseriesSchema>): TimeseriesQuery {
  return {
    indicator: query.indicator,
    areaType: query.areaType,
    area: query.area,
    ...(query.category !== undefined ? { category: query.category } : {}),
    ...(query.from !== undefined ? { from: query.from } : {}),
    ...(query.to !== undefined ? { to: query.to } : {}),
  };
}

export function toAreasQuery(query: z.infer<typeof AreasSchema>): AreasQuery {
  return {
    indicator: query.indicator,
    areaType: query.areaType,
    ...(query.category !== undefined ? { category: query.category } : {}),
    ...(query.like !== undefined ? { like: query.like } : {}),
  };
}

export function toRankingQuery(query: z.infer<typeof RankingSchema>): RankingQuery {
  return {
    indicator: query.indicator,
    areaType: query.areaType,
    year: query.year,
    ...(query.category !== undefined ? { category: query.category } : {}),
    limit: query.limit,
    order: query.order,
  };
}
