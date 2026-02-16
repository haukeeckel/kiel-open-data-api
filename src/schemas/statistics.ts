import { z } from 'zod';

import {
  ORDERS,
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  PAGINATION_LIMIT_MIN,
  PAGINATION_OFFSET_DEFAULT,
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
const CSV_AREA_DESCRIPTION =
  'Comma-separated area list. Example: Altstadt,Gaarden-Ost. Empty tokens are invalid (e.g. Altstadt,,Gaarden-Ost). Tokens are trimmed and each token must be <= 200 chars.';
const CSV_CATEGORY_DESCRIPTION =
  'Comma-separated category list. For indicator=population use total. For indicator=gender use values like male,female. Empty tokens are invalid (e.g. male,,female). Tokens are trimmed and each token must be <= 120 chars.';
const INDICATOR_DESCRIPTION = 'Indicator slug.';
const AREA_TYPE_DESCRIPTION = 'Area type slug.';
const CATEGORY_DESCRIPTION = 'Category value filter.';
const YEAR_DESCRIPTION = 'Calendar year.';
const PAGINATION_LIMIT_DESCRIPTION = 'Page size (max number of rows per response page).';
const PAGINATION_OFFSET_DESCRIPTION = 'Page offset (number of rows skipped before page starts).';

const IndicatorQueryParam = Indicator.max(QUERY_TEXT_MAX)
  .describe(INDICATOR_DESCRIPTION)
  .meta({
    example: 'population',
    examples: ['population', 'gender'],
  });

const AreaTypeQueryParam = AreaType.max(QUERY_TEXT_MAX)
  .describe(AREA_TYPE_DESCRIPTION)
  .meta({
    example: 'district',
    examples: ['district'],
  });

const AreaQueryParam = z
  .string()
  .min(1)
  .max(QUERY_AREA_MAX)
  .describe('Area name filter.')
  .meta({ example: 'Altstadt', examples: ['Altstadt', 'Wik'] });

const CategoryQueryParam = Category.describe(CATEGORY_DESCRIPTION).meta({
  example: 'total',
  examples: ['total'],
});

const PaginationLimitQueryParam = z.coerce
  .number()
  .int()
  .min(PAGINATION_LIMIT_MIN)
  .max(PAGINATION_LIMIT_MAX)
  .default(PAGINATION_LIMIT_DEFAULT)
  .describe(PAGINATION_LIMIT_DESCRIPTION)
  .meta({ example: PAGINATION_LIMIT_DEFAULT, examples: [10, 50, 100] });

const PaginationOffsetQueryParam = z.coerce
  .number()
  .int()
  .min(PAGINATION_OFFSET_DEFAULT)
  .default(PAGINATION_OFFSET_DEFAULT)
  .describe(PAGINATION_OFFSET_DESCRIPTION)
  .meta({ example: PAGINATION_OFFSET_DEFAULT, examples: [0, 10, 100] });

const PaginationMeta = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

function hasNoEmptyCsvTokens(value: string): boolean {
  const parts = value.split(',').map((part) => part.trim());
  return parts.length > 0 && parts.every((part) => part.length > 0);
}

function csvTokenMax(max: number) {
  return (value: string) => value.split(',').every((part) => part.trim().length <= max);
}

function csvAreaParam(args: { description: string; examples: string[] }) {
  const schema = z
    .string()
    .min(1)
    .refine(hasNoEmptyCsvTokens, { message: 'Invalid CSV list' })
    .refine(csvTokenMax(QUERY_AREA_MAX), { message: 'CSV token too long' })
    .describe(args.description);
  return schema.meta({ examples: args.examples });
}

function csvCategoryParam(args: { description: string; examples: string[] }) {
  const schema = z
    .string()
    .min(1)
    .refine(hasNoEmptyCsvTokens, { message: 'Invalid CSV list' })
    .refine(csvTokenMax(QUERY_TEXT_MAX), { message: 'CSV token too long' })
    .describe(args.description);
  return schema.meta({ examples: args.examples });
}

export const TimeseriesQuery = z.object({
  indicator: IndicatorQueryParam,
  areaType: AreaTypeQueryParam,
  areas: csvAreaParam({
    description: CSV_AREA_DESCRIPTION,
    examples: ['Altstadt,Gaarden-Ost', 'Altstadt,Vorstadt'],
  }),
  categories: csvCategoryParam({
    description: CSV_CATEGORY_DESCRIPTION,
    examples: ['total', 'male,female'],
  }).optional(),
  from: z.coerce
    .number()
    .int()
    .describe('Start year (inclusive).')
    .meta({ example: 2022, examples: [2022] })
    .optional(),
  to: z.coerce
    .number()
    .int()
    .describe('End year (inclusive).')
    .meta({ example: 2023, examples: [2023] })
    .optional(),
  limit: PaginationLimitQueryParam,
  offset: PaginationOffsetQueryParam,
});

export const TimeseriesResponse = z
  .object({
    indicator: z.string(),
    areaType: z.string(),
    areas: z.array(z.string()),
    rows: z.array(
      z.object({
        area: z.string(),
        year: z.number().int(),
        value: z.number(),
        unit: z.string(),
        category: z.string(),
      }),
    ),
    pagination: PaginationMeta,
  })
  .meta({
    examples: [
      {
        indicator: 'population',
        areaType: 'district',
        areas: ['Altstadt'],
        rows: [
          { area: 'Altstadt', year: 2022, value: 1213, unit: 'persons', category: 'total' },
          { area: 'Altstadt', year: 2023, value: 1220, unit: 'persons', category: 'total' },
        ],
        pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
      },
    ],
  });

export const AreasQuery = z.object({
  indicator: IndicatorQueryParam,
  areaType: AreaTypeQueryParam,
  category: CategoryQueryParam.optional(),
  like: z
    .string()
    .min(1)
    .max(QUERY_LIKE_MAX)
    .describe('Case-insensitive text filter for area names.')
    .meta({ example: 'gaard', examples: ['gaard', 'stadt'] })
    .optional(),
});

export const AreasResponse = z
  .object({
    indicator: z.string(),
    areaType: z.string(),
    rows: z.array(z.string()),
  })
  .meta({
    examples: [
      {
        indicator: 'population',
        areaType: 'district',
        rows: ['Altstadt', 'Gaarden-Ost', 'Schreventeich'],
      },
    ],
  });

export const CategoriesQuery = z.object({
  indicator: IndicatorQueryParam,
  areaType: AreaTypeQueryParam,
});

export const CategoriesResponse = z
  .object({
    indicator: z.string(),
    areaType: z.string(),
    rows: z.array(z.string()),
  })
  .meta({
    examples: [
      {
        indicator: 'gender',
        areaType: 'district',
        rows: ['female', 'male', 'total'],
      },
    ],
  });

export const RankingQuery = z.object({
  indicator: IndicatorQueryParam,
  areaType: AreaTypeQueryParam,
  year: z.coerce
    .number()
    .int()
    .describe(YEAR_DESCRIPTION)
    .meta({ example: 2023, examples: [2023, 2022] }),
  categories: csvCategoryParam({
    description: CSV_CATEGORY_DESCRIPTION,
    examples: ['total', 'male,female'],
  }).optional(),
  areas: csvAreaParam({
    description: CSV_AREA_DESCRIPTION,
    examples: ['Altstadt,Vorstadt'],
  }).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(RANKING_LIMIT_MIN)
    .max(RANKING_LIMIT_MAX)
    .default(RANKING_LIMIT_DEFAULT)
    .describe('Maximum number of ranking rows to return.')
    .meta({ example: 10, examples: [10, 25] }),
  order: z
    .enum(ORDERS)
    .default('desc')
    .describe('Ranking sort order.')
    .meta({ example: 'desc', examples: ['desc', 'asc'] }),
});

export const RankingResponse = z
  .object({
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
  })
  .meta({
    examples: [
      {
        indicator: 'population',
        areaType: 'district',
        year: 2023,
        order: 'desc',
        limit: 2,
        rows: [
          { area: 'Schreventeich', value: 1432, unit: 'persons', category: 'total' },
          { area: 'Altstadt', value: 1220, unit: 'persons', category: 'total' },
        ],
      },
    ],
  });

export const YearsQuery = z.object({
  indicator: IndicatorQueryParam.optional(),
  areaType: AreaTypeQueryParam.optional(),
  category: CategoryQueryParam.optional(),
  area: AreaQueryParam.optional(),
  limit: PaginationLimitQueryParam,
  offset: PaginationOffsetQueryParam,
});

export const YearsResponse = z
  .object({ rows: z.array(z.number().int()), pagination: PaginationMeta })
  .meta({
    examples: [
      {
        rows: [2018, 2019, 2020, 2022, 2023],
        pagination: { total: 5, limit: 50, offset: 0, hasMore: false },
      },
    ],
  });

export const IndicatorsQuery = z.object({
  areaType: AreaTypeQueryParam.optional(),
  area: AreaQueryParam.optional(),
  year: z.coerce
    .number()
    .int()
    .describe(YEAR_DESCRIPTION)
    .meta({ example: 2023, examples: [2023, 2018] })
    .optional(),
  limit: PaginationLimitQueryParam,
  offset: PaginationOffsetQueryParam,
});

export const IndicatorsResponse = z
  .object({ rows: z.array(z.string()), pagination: PaginationMeta })
  .meta({
    examples: [
      {
        rows: ['population', 'gender', 'households'],
        pagination: { total: 3, limit: 50, offset: 0, hasMore: false },
      },
    ],
  });

export const IndicatorPathParams = z.object({
  indicator: Indicator.max(QUERY_TEXT_MAX),
});

export const IndicatorMetaResponse = z
  .object({
    indicator: z.string(),
    areaTypes: z.array(
      z.object({
        areaType: z.string(),
        years: z.array(z.number().int()),
        categories: z.array(z.string()),
        areas: z.array(z.string()),
      }),
    ),
  })
  .meta({
    examples: [
      {
        indicator: 'gender',
        areaTypes: [
          {
            areaType: 'district',
            years: [2022, 2023],
            categories: ['female', 'male', 'total'],
            areas: ['Altstadt', 'Vorstadt'],
          },
        ],
      },
    ],
  });

export const YearPathParams = z.object({
  year: z.coerce.number().int(),
});

export const YearMetaResponse = z
  .object({
    year: z.number().int(),
    areaTypes: z.array(
      z.object({
        areaType: z.string(),
        indicators: z.array(z.string()),
        categories: z.array(z.string()),
        areas: z.array(z.string()),
      }),
    ),
  })
  .meta({
    examples: [
      {
        year: 2023,
        areaTypes: [
          {
            areaType: 'district',
            indicators: ['population', 'gender'],
            categories: ['female', 'male', 'total'],
            areas: ['Altstadt', 'Gaarden-Ost', 'Schreventeich'],
          },
        ],
      },
    ],
  });

export const AreaTypesResponse = z.object({ rows: z.array(z.string()) }).meta({
  examples: [{ rows: ['district'] }],
});

export const CapabilitiesResponse = z
  .object({
    areaTypes: z.array(z.string()),
    indicators: z.array(z.string()),
    years: z.array(z.number().int()),
    limits: z.object({
      pagination: z.object({
        min: z.number().int().positive(),
        max: z.number().int().positive(),
        default: z.number().int().positive(),
      }),
      ranking: z.object({
        min: z.number().int().positive(),
        max: z.number().int().positive(),
        default: z.number().int().positive(),
      }),
    }),
  })
  .meta({
    examples: [
      {
        areaTypes: ['district'],
        indicators: ['population', 'gender', 'households'],
        years: [2018, 2019, 2020, 2022, 2023],
        limits: {
          pagination: {
            min: PAGINATION_LIMIT_MIN,
            max: PAGINATION_LIMIT_MAX,
            default: PAGINATION_LIMIT_DEFAULT,
          },
          ranking: {
            min: RANKING_LIMIT_MIN,
            max: RANKING_LIMIT_MAX,
            default: RANKING_LIMIT_DEFAULT,
          },
        },
      },
    ],
  });
