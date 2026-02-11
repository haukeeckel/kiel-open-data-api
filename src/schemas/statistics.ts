import { z } from 'zod';

export const INDICATORS = ['population'] as const;
export const AREA_TYPES = ['district'] as const;

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

export const RANKING_LIMIT_MIN = 1;
export const RANKING_LIMIT_MAX = 100;
export const RANKING_LIMIT_DEFAULT = 50;

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
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const RankingResponse = z.object({
  indicator: z.string(),
  areaType: z.string(),
  year: z.number().int(),
  order: z.enum(['asc', 'desc']),
  limit: z.number().int(),
  rows: z.array(
    z.object({
      area: z.string(),
      value: z.number(),
      unit: z.string(),
    }),
  ),
});

export type TimeseriesQueryInput = z.infer<typeof TimeseriesQuery>;
export type AreasQueryInput = z.infer<typeof AreasQuery>;
export type RankingQueryInput = z.infer<typeof RankingQuery>;
