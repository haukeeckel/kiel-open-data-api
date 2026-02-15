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
      'Get time series for indicator/areaType with CSV filters: area=Altstadt,Gaarden-Ost and optional category=male,female. Response uses areas[] and rows[].area.',
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
      'Get ranking for indicator/year with optional CSV filters category=... and area=...',
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
    querystring: IndicatorsQuery,
    response: {
      200: IndicatorsResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const indicatorMetaRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'Get grouped metadata for one indicator',
    params: IndicatorPathParams,
    response: {
      200: IndicatorMetaResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const yearsRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'List available years with optional discovery filters',
    querystring: YearsQuery,
    response: {
      200: YearsResponse,
      ...ERROR_RESPONSES,
    },
  },
};

export const yearMetaRouteSchema = {
  schema: {
    tags: ['statistics'],
    description: 'Get grouped metadata for one year',
    params: YearPathParams,
    response: {
      200: YearMetaResponse,
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
