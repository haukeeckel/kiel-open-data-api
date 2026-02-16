import type {
  AreasQuery,
  BulkRequest,
  CategoriesQuery,
  IndicatorsQuery,
  RankingQuery,
  TimeseriesQuery,
  YearsQuery,
} from '../../domains/statistics/model/types.js';
import type {
  AreasQuery as AreasSchema,
  BulkRequestBody as BulkRequestBodySchema,
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
    limit: query.limit,
    offset: query.offset,
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
    limit: query.limit,
    offset: query.offset,
  };
}

export function toIndicatorsQuery(query: z.infer<typeof IndicatorsSchema>): IndicatorsQuery {
  return {
    ...(query.areaType !== undefined ? { areaType: query.areaType } : {}),
    ...(query.area !== undefined ? { area: query.area } : {}),
    ...(query.year !== undefined ? { year: query.year } : {}),
    limit: query.limit,
    offset: query.offset,
  };
}

export function toBulkRequest(body: z.infer<typeof BulkRequestBodySchema>): BulkRequest {
  return {
    items: body.items.map((item) => {
      if (item.kind === 'timeseries') {
        return {
          kind: 'timeseries',
          query: {
            indicator: item.query.indicator,
            areaType: item.query.areaType,
            areas: Array.from(new Set(item.query.areas.map((part) => part.trim()))),
            ...(item.query.categories !== undefined
              ? {
                  categories: Array.from(new Set(item.query.categories.map((part) => part.trim()))),
                }
              : {}),
            ...(item.query.from !== undefined ? { from: item.query.from } : {}),
            ...(item.query.to !== undefined ? { to: item.query.to } : {}),
            limit: item.query.limit,
            offset: item.query.offset,
          },
        } as const;
      }
      if (item.kind === 'ranking') {
        return {
          kind: 'ranking',
          query: {
            indicator: item.query.indicator,
            areaType: item.query.areaType,
            year: item.query.year,
            ...(item.query.categories !== undefined
              ? {
                  categories: Array.from(new Set(item.query.categories.map((part) => part.trim()))),
                }
              : {}),
            ...(item.query.areas !== undefined
              ? { areas: Array.from(new Set(item.query.areas.map((part) => part.trim()))) }
              : {}),
            limit: item.query.limit,
            order: item.query.order,
          },
        } as const;
      }
      return { kind: 'capabilities' } as const;
    }),
  };
}
