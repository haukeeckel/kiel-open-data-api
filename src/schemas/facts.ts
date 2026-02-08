import z from 'zod';

export const TimeseriesQuery = z.object({
  indicator: z.string().min(1),
  areaType: z.string().min(1),
  area: z.string().min(1),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
});

export const AreasQuery = z.object({
  indicator: z.string().min(1),
  areaType: z.string().min(1),
  like: z.string().min(1).optional(),
});

export const RankingQuery = z.object({
  indicator: z.string().min(1),
  areaType: z.string().min(1),
  year: z.coerce.number().int(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type TimeseriesQueryInput = z.infer<typeof TimeseriesQuery>;
export type AreasQueryInput = z.infer<typeof AreasQuery>;
export type RankingQueryInput = z.infer<typeof RankingQuery>;
