import { ApiError } from '../../schemas/api.js';
import {
  AreasQuery,
  AreasResponse,
  CategoriesQuery,
  CategoriesResponse,
  RankingQuery,
  RankingResponse,
  TimeseriesQuery,
  TimeseriesResponse,
} from '../../schemas/statistics.js';

export const timeseriesRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'Get time series for a given indicator and area',
    querystring: TimeseriesQuery,
    response: {
      200: TimeseriesResponse,
      400: ApiError,
      500: ApiError,
    },
  },
};

export const areasRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'List distinct areas for an indicator and area type',
    querystring: AreasQuery,
    response: {
      200: AreasResponse,
      400: ApiError,
      500: ApiError,
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
      400: ApiError,
      500: ApiError,
    },
  },
};

export const rankingRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'Get ranking of areas by value for a given indicator/year',
    querystring: RankingQuery,
    response: {
      200: RankingResponse,
      400: ApiError,
      500: ApiError,
    },
  },
};
