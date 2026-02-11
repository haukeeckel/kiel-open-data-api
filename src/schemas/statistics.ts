import { z } from 'zod';

import {
  AREA_TYPES,
  INDICATORS,
  ORDERS,
  RANKING_LIMIT_DEFAULT,
  RANKING_LIMIT_MAX,
  RANKING_LIMIT_MIN,
} from '../domains/statistics/model/types.js';

const Indicator = z.enum(INDICATORS);
const AreaType = z.enum(AREA_TYPES);

export const TimeseriesQuery = z.object({
  indicator: Indicator,
  areaType: AreaType,
  area: z.string().min(1),
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
    }),
  ),
});

export const AreasQuery = z.object({
  indicator: Indicator,
  areaType: AreaType,
  like: z.string().min(1).optional(),
});

export const AreasResponse = z.object({
  indicator: z.string(),
  areaType: z.string(),
  rows: z.array(z.string()),
});

export const RankingQuery = z.object({
  indicator: Indicator,
  areaType: AreaType,
  year: z.coerce.number().int(),
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
    }),
  ),
});
