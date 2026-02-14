import { ApiError } from '../../schemas/api.js';
import {
  AreaTypesResponse,
  AreasQuery,
  AreasResponse,
  CategoriesQuery,
  CategoriesResponse,
  IndicatorsResponse,
  RankingQuery,
  RankingResponse,
  TimeseriesQuery,
  TimeseriesResponse,
} from '../../schemas/statistics.js';

const ERROR_RESPONSES = {
  400: ApiError,
  401: ApiError,
  403: ApiError,
  404: ApiError,
  409: ApiError,
  422: ApiError,
  429: ApiError,
  500: ApiError,
} as const;

export const timeseriesRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'Get time series for a given indicator and area (omitting category returns all categories)',
    querystring: TimeseriesQuery,
    response: {
      200: TimeseriesResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const areasRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'List distinct areas for an indicator and area type (omitting category returns areas across all categories)',
    querystring: AreasQuery,
    response: {
      200: AreasResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const categoriesRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'List distinct categories for an indicator and area type',
    querystring: CategoriesQuery,
    response: {
      200: CategoriesResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const rankingRouteSchema = {
  schema: {
    tags: ['statistics'],
    description:
      'Get ranking of areas by value for a given indicator/year (omitting category returns mixed categories)',
    querystring: RankingQuery,
    response: {
      200: RankingResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const indicatorsRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'List all available indicators',
    response: {
      200: IndicatorsResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const areaTypesRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'List all available area types',
    response: {
      200: AreaTypesResponse,
      ...ERROR_RESPONSES,
    },
  },
};
