import type {
  AreasQuery,
  CategoriesQuery,
  IndicatorsQuery,
  RankingQuery,
  TimeseriesQuery,
  YearsQuery,
} from '../../domains/statistics/model/types.js';
import type {
  AreasQuery as AreasSchema,
  CategoriesQuery as CategoriesSchema,
  IndicatorsQuery as IndicatorsSchema,
  RankingQuery as RankingSchema,
  TimeseriesQuery as TimeseriesSchema,
  YearsQuery as YearsSchema,
} from '../../schemas/statistics.js';
import type { z } from 'zod';

function parseCsvParam(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.from(new Set(value.split(',').map((part) => part.trim())));
}

export function toTimeseriesQuery(query: z.infer<typeof TimeseriesSchema>): TimeseriesQuery {
  const areas = parseCsvParam(query.areas) ?? [];
  const categories = parseCsvParam(query.categories);
  return {
    indicator: query.indicator,
    areaType: query.areaType,
    areas,
    ...(categories !== undefined ? { categories } : {}),
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
  const categories = parseCsvParam(query.categories);
  const areas = parseCsvParam(query.areas);
  return {
    indicator: query.indicator,
    areaType: query.areaType,
    year: query.year,
    ...(categories !== undefined ? { categories } : {}),
    ...(areas !== undefined ? { areas } : {}),
    limit: query.limit,
    order: query.order,
  };
}

export function toYearsQuery(query: z.infer<typeof YearsSchema>): YearsQuery {
  return {
    ...(query.indicator !== undefined ? { indicator: query.indicator } : {}),
    ...(query.areaType !== undefined ? { areaType: query.areaType } : {}),
    ...(query.category !== undefined ? { category: query.category } : {}),
    ...(query.area !== undefined ? { area: query.area } : {}),
  };
}

export function toIndicatorsQuery(query: z.infer<typeof IndicatorsSchema>): IndicatorsQuery {
  return {
    ...(query.areaType !== undefined ? { areaType: query.areaType } : {}),
    ...(query.area !== undefined ? { area: query.area } : {}),
    ...(query.year !== undefined ? { year: query.year } : {}),
  };
}
