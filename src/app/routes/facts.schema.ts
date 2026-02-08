// src/app/routes/facts.schema.ts
const ApiErrorRef = { $ref: 'ApiError#' } as const;

export const timeseriesRouteSchema = {
  schema: {
    tags: ['facts'],
    description: 'Get time series for a given indicator and area',
    querystring: {
      type: 'object',
      properties: {
        indicator: { type: 'string' },
        areaType: { type: 'string' },
        area: { type: 'string' },
        from: { type: 'integer' },
        to: { type: 'integer' },
      },
      required: ['indicator', 'areaType', 'area'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          indicator: { type: 'string' },
          areaType: { type: 'string' },
          area: { type: 'string' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                year: { type: 'integer' },
                value: { type: 'number' },
                unit: { type: 'string' },
              },
              required: ['year', 'value', 'unit'],
            },
          },
        },
        required: ['indicator', 'areaType', 'area', 'rows'],
      },
      400: ApiErrorRef,
      500: ApiErrorRef,
    },
  },
};

export const areasRouteSchema = {
  schema: {
    tags: ['facts'],
    description: 'List distinct areas for an indicator and area type',
    querystring: {
      type: 'object',
      properties: {
        indicator: { type: 'string' },
        areaType: { type: 'string' },
        like: { type: 'string' },
      },
      required: ['indicator', 'areaType'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          indicator: { type: 'string' },
          areaType: { type: 'string' },
          rows: { type: 'array', items: { type: 'string' } },
        },
        required: ['indicator', 'areaType', 'rows'],
      },
      400: ApiErrorRef,
      500: ApiErrorRef,
    },
  },
};

export const rankingRouteSchema = {
  schema: {
    tags: ['facts'],
    description: 'Get ranking of areas by value for a given indicator/year',
    querystring: {
      type: 'object',
      properties: {
        indicator: { type: 'string' },
        areaType: { type: 'string' },
        year: { type: 'integer' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
      },
      required: ['indicator', 'areaType', 'year'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          indicator: { type: 'string' },
          areaType: { type: 'string' },
          year: { type: 'integer' },
          order: { type: 'string' },
          limit: { type: 'integer' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                area: { type: 'string' },
                value: { type: 'number' },
                unit: { type: 'string' },
              },
              required: ['area', 'value', 'unit'],
            },
          },
        },
        required: ['indicator', 'areaType', 'year', 'order', 'limit', 'rows'],
      },
      400: ApiErrorRef,
      500: ApiErrorRef,
    },
  },
};
