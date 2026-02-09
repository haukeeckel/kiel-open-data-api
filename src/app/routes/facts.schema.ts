import {
  AreasQuery,
  AreasResponse,
  RankingQuery,
  RankingResponse,
  TimeseriesQuery,
  TimeseriesResponse,
} from '../../schemas/facts';
import { ApiError } from '../../schemas/api';

export const timeseriesRouteSchema = {
  schema: {
    tags: ['facts'],
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
    tags: ['facts'],
    description: 'List distinct areas for an indicator and area type',
    querystring: AreasQuery,
    response: {
      200: AreasResponse,
      400: ApiError,
      500: ApiError,
    },
  },
};

export const rankingRouteSchema = {
  schema: {
    tags: ['facts'],
    description: 'Get ranking of areas by value for a given indicator/year',
    querystring: RankingQuery,
    response: {
      200: RankingResponse,
      400: ApiError,
      500: ApiError,
    },
  },
};
