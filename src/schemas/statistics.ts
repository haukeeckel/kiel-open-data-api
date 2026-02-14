import { z } from 'zod';

import {
  ORDERS,
  RANKING_LIMIT_DEFAULT,
  RANKING_LIMIT_MAX,
  RANKING_LIMIT_MIN,
} from '../domains/statistics/model/types.js';

const Indicator = z.string().min(1);
const AreaType = z.string().min(1);
const QUERY_TEXT_MAX = 120;
const QUERY_AREA_MAX = 200;
const QUERY_LIKE_MAX = 120;
const Category = z.string().min(1).max(QUERY_TEXT_MAX);

export const TimeseriesQuery = z.object({
  indicator: Indicator.max(QUERY_TEXT_MAX),
  areaType: AreaType.max(QUERY_TEXT_MAX),
  area: z.string().min(1).max(QUERY_AREA_MAX),
  category: Category.optional(),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
});

export const TimeseriesResponse = z.object({
  indicator: z.string(),
  areaType: z.string(),
  area: z.string(),
  rows: z.array(
    z.object({
      year: z.number().int(),
      value: z.number(),
      unit: z.string(),
      category: z.string(),
    }),
  ),
});

export const AreasQuery = z.object({
  indicator: Indicator.max(QUERY_TEXT_MAX),
  areaType: AreaType.max(QUERY_TEXT_MAX),
  category: Category.optional(),
  like: z.string().min(1).max(QUERY_LIKE_MAX).optional(),
});

export const AreasResponse = z.object({
  indicator: z.string(),
  areaType: z.string(),
  rows: z.array(z.string()),
});

export const CategoriesQuery = z.object({
  indicator: Indicator.max(QUERY_TEXT_MAX),
  areaType: AreaType.max(QUERY_TEXT_MAX),
});

export const CategoriesResponse = z.object({
  indicator: z.string(),
  areaType: z.string(),
  rows: z.array(z.string()),
});

export const RankingQuery = z.object({
  indicator: Indicator.max(QUERY_TEXT_MAX),
  areaType: AreaType.max(QUERY_TEXT_MAX),
  year: z.coerce.number().int(),
  category: Category.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(RANKING_LIMIT_MIN)
    .max(RANKING_LIMIT_MAX)
    .default(RANKING_LIMIT_DEFAULT),
  order: z.enum(ORDERS).default('desc'),
});

export const RankingResponse = z.object({
  indicator: z.string(),
  areaType: z.string(),
  year: z.number().int(),
  order: z.enum(ORDERS),
  limit: z.number().int(),
  rows: z.array(
    z.object({
      area: z.string(),
      value: z.number(),
      unit: z.string(),
      category: z.string(),
    }),
  ),
});

export const YearsQuery = z.object({
  indicator: Indicator.max(QUERY_TEXT_MAX).optional(),
  areaType: AreaType.max(QUERY_TEXT_MAX).optional(),
  category: Category.optional(),
  area: z.string().min(1).max(QUERY_AREA_MAX).optional(),
});

export const YearsResponse = z.object({
  rows: z.array(z.number().int()),
});

export const IndicatorsQuery = z.object({
  areaType: AreaType.max(QUERY_TEXT_MAX).optional(),
  area: z.string().min(1).max(QUERY_AREA_MAX).optional(),
  year: z.coerce.number().int().optional(),
});

export const IndicatorsResponse = z.object({
  rows: z.array(z.string()),
});

export const IndicatorPathParams = z.object({
  indicator: Indicator.max(QUERY_TEXT_MAX),
});

export const IndicatorMetaResponse = z.object({
  indicator: z.string(),
  areaTypes: z.array(
    z.object({
      areaType: z.string(),
      years: z.array(z.number().int()),
      categories: z.array(z.string()),
      areas: z.array(z.string()),
    }),
  ),
});

export const YearPathParams = z.object({
  year: z.coerce.number().int(),
});

export const YearMetaResponse = z.object({
  year: z.number().int(),
  areaTypes: z.array(
    z.object({
      areaType: z.string(),
      indicators: z.array(z.string()),
      categories: z.array(z.string()),
      areas: z.array(z.string()),
    }),
  ),
});

export const AreaTypesResponse = z.object({
  rows: z.array(z.string()),
});
