import type {
  AreasQuery,
  CategoriesQuery,
  RankingQuery,
  TimeseriesQuery,
} from '../../domains/statistics/model/types.js';
import type {
  AreasQuery as AreasSchema,
  CategoriesQuery as CategoriesSchema,
  RankingQuery as RankingSchema,
  TimeseriesQuery as TimeseriesSchema,
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

export function toCategoriesQuery(query: z.infer<typeof CategoriesSchema>): CategoriesQuery {
  return {
    indicator: query.indicator,
    areaType: query.areaType,
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
