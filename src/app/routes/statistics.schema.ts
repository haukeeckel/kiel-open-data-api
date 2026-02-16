import { z } from 'zod';

import {
  ApiBadRequestError,
  ApiConflictError,
  ApiForbiddenError,
  ApiInternalError,
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
  ApiUnprocessableEntityError,
} from '../../schemas/api.js';
import {
  AreaTypesResponse,
  AreasQuery,
  AreasResponse,
  BulkRequestBody,
  BulkResponse,
  CapabilitiesResponse,
  CategoriesQuery,
  CategoriesResponse,
  IndicatorMetaResponse,
  IndicatorPathParams,
  IndicatorsQuery,
  IndicatorsResponse,
  RankingQuery,
  RankingResponse,
  TimeseriesQuery,
  TimeseriesResponse,
  YearMetaResponse,
  YearPathParams,
  YearsQuery,
  YearsResponse,
} from '../../schemas/statistics.js';

const CONDITIONAL_GET_HEADERS = z
  .object({
    'if-none-match': z
      .string()
      .describe(
        'Optional ETag for conditional requests. When it matches the current representation, the API returns 304.',
      )
      .optional(),
  })
  .passthrough();

const NotModifiedResponse = z
  .null()
  .describe(
    'Not Modified. Returned when If-None-Match matches the current representation. Cache headers (ETag, Cache-Control, Data-Version, Last-Updated-At) are included.',
  );

const ERROR_RESPONSES = {
  400: ApiBadRequestError,
  401: ApiUnauthorizedError,
  403: ApiForbiddenError,
  404: ApiNotFoundError,
  409: ApiConflictError,
  422: ApiUnprocessableEntityError,
  429: ApiTooManyRequestsError,
  500: ApiInternalError,
} as const;

export const timeseriesRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'Get yearly time-series values for an indicator and area type. Supports CSV filters for areas and optional categories and uses offset pagination (`limit`, `offset`). Includes ETag, Cache-Control, Data-Version and Last-Updated-At headers.',
    headers: CONDITIONAL_GET_HEADERS,
    querystring: TimeseriesQuery,
    response: {
      200: TimeseriesResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const areasRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'List distinct areas for indicator and area type. Omitting category returns areas across all categories. Supports conditional GET with If-None-Match and returns freshness headers.',
    headers: CONDITIONAL_GET_HEADERS,
    querystring: AreasQuery,
    response: {
      200: AreasResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const categoriesRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'List distinct categories for indicator and area type. Supports conditional GET with If-None-Match and returns freshness headers.',
    headers: CONDITIONAL_GET_HEADERS,
    querystring: CategoriesQuery,
    response: {
      200: CategoriesResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const rankingRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'Get ranking values for indicator and year. Supports optional CSV filters for categories and areas. Includes ETag, Cache-Control, Data-Version and Last-Updated-At headers.',
    headers: CONDITIONAL_GET_HEADERS,
    querystring: RankingQuery,
    response: {
      200: RankingResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const indicatorsRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'List available indicators with optional discovery filters and offset pagination (`limit`, `offset`). Supports conditional GET with freshness headers.',
    headers: CONDITIONAL_GET_HEADERS,
    querystring: IndicatorsQuery,
    response: {
      200: IndicatorsResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const indicatorMetaRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'Get grouped metadata for a single indicator. Supports conditional GET with freshness headers.',
    headers: CONDITIONAL_GET_HEADERS,
    params: IndicatorPathParams,
    response: {
      200: IndicatorMetaResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const yearsRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'List available years with optional discovery filters and offset pagination (`limit`, `offset`). Supports conditional GET with freshness headers.',
    headers: CONDITIONAL_GET_HEADERS,
    querystring: YearsQuery,
    response: {
      200: YearsResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const yearMetaRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'Get grouped metadata for a single year. Supports conditional GET with freshness headers.',
    headers: CONDITIONAL_GET_HEADERS,
    params: YearPathParams,
    response: {
      200: YearMetaResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const areaTypesRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'List all available area types. Supports conditional GET with freshness headers.',
    headers: CONDITIONAL_GET_HEADERS,
    response: {
      200: AreaTypesResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const capabilitiesRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'Discovery endpoint for initial client configuration. Returns areaTypes, indicators, years and current API limits.',
    headers: CONDITIONAL_GET_HEADERS,
    response: {
      200: CapabilitiesResponse,
      304: NotModifiedResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const bulkRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'Bulk read endpoint for consumer workflows. Executes each item in order and returns results in the same order.',
    body: BulkRequestBody,
    response: {
      200: BulkResponse,
      ...ERROR_RESPONSES,
    },
  },
};
