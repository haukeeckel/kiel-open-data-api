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
  CategoriesQuery,
  CategoriesResponse,
  IndicatorsResponse,
  RankingQuery,
  RankingResponse,
  TimeseriesQuery,
  TimeseriesResponse,
} from '../../schemas/statistics.js';

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
