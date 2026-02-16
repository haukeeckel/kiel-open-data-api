import { z } from 'zod';

import { API_ERROR_CODES, API_ERROR_REASONS } from '../app/http/errors.js';

const ValidationDetailItem = z
  .object({
    instancePath: z.string().optional(),
    schemaPath: z.string().optional(),
    keyword: z.string().optional(),
    message: z.string().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const DomainValidationDetails = z.object({
  kind: z.literal('domain_validation'),
  field: z.enum(['indicator', 'areaType', 'category']),
  value: z.string(),
  allowed: z.array(z.string()),
});

const RateLimitDetails = z.object({
  kind: z.literal('rate_limit'),
  retryAfterMs: z.number().int().positive().optional(),
  retryAfterSec: z.number().int().positive().optional(),
});

const FallbackDetails = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]);

const ApiErrorDetails = z
  .union([
    z.array(ValidationDetailItem),
    DomainValidationDetails,
    RateLimitDetails,
    FallbackDetails,
  ])
  .optional();

function makeApiErrorSchema(args: {
  code: (typeof API_ERROR_CODES)[number];
  details?: z.ZodTypeAny;
  examples?: unknown[];
}) {
  const { code, details, examples } = args;
  return z
    .object({
      error: z.object({
        code: z.literal(code),
        message: z.string(),
        reason: z.enum(API_ERROR_REASONS).optional(),
        suggestions: z.array(z.string()).optional(),
        ...(details !== undefined ? { details: details.optional() } : {}),
      }),
      requestId: z.string(),
    })
    .meta(examples !== undefined ? { examples } : {});
}

export const ApiError = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    reason: z.enum(API_ERROR_REASONS).optional(),
    suggestions: z.array(z.string()).optional(),
    details: ApiErrorDetails,
  }),
  requestId: z.string(),
});

export const ApiBadRequestError = makeApiErrorSchema({
  code: 'BAD_REQUEST',
  details: z.union([z.array(ValidationDetailItem), DomainValidationDetails, FallbackDetails]),
  examples: [
    {
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid query parameters',
        reason: 'INVALID_QUERY_PARAMS',
        details: [
          {
            instancePath: '/from',
            message: 'Invalid input: expected number, received NaN',
          },
        ],
      },
      requestId: 'req-bad-request-example',
    },
    {
      error: {
        code: 'BAD_REQUEST',
        message: 'Unknown indicator: unknown',
        reason: 'UNKNOWN_INDICATOR',
        suggestions: ['population', 'gender', 'households'],
        details: {
          kind: 'domain_validation',
          field: 'indicator',
          value: 'unknown',
          allowed: ['population', 'gender', 'households'],
        },
      },
      requestId: 'req-bad-request-unknown-indicator',
    },
    {
      error: {
        code: 'BAD_REQUEST',
        message: 'Unknown areaType: unknown',
        reason: 'UNKNOWN_AREA_TYPE',
        suggestions: ['district'],
        details: {
          kind: 'domain_validation',
          field: 'areaType',
          value: 'unknown',
          allowed: ['district'],
        },
      },
      requestId: 'req-bad-request-unknown-area-type',
    },
    {
      error: {
        code: 'BAD_REQUEST',
        message: 'Unknown category: other',
        reason: 'UNKNOWN_CATEGORY',
        suggestions: ['female', 'male', 'total'],
        details: {
          kind: 'domain_validation',
          field: 'category',
          value: 'other',
          allowed: ['female', 'male', 'total'],
        },
      },
      requestId: 'req-bad-request-unknown-category',
    },
    {
      error: {
        code: 'BAD_REQUEST',
        message: 'from must be <= to',
        reason: 'INVALID_RANGE',
        details: {
          from: 2024,
          to: 2023,
        },
      },
      requestId: 'req-bad-request-invalid-range',
    },
  ],
});
export const ApiUnauthorizedError = makeApiErrorSchema({
  code: 'UNAUTHORIZED',
  examples: [
    {
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      requestId: 'req-unauthorized-example',
    },
  ],
});
export const ApiForbiddenError = makeApiErrorSchema({
  code: 'FORBIDDEN',
  examples: [
    {
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
      requestId: 'req-forbidden-example',
    },
  ],
});
export const ApiNotFoundError = makeApiErrorSchema({
  code: 'NOT_FOUND',
  examples: [
    {
      error: { code: 'NOT_FOUND', message: 'Indicator not found: unknown' },
      requestId: 'req-not-found-example',
    },
  ],
});
export const ApiConflictError = makeApiErrorSchema({
  code: 'CONFLICT',
  examples: [
    {
      error: { code: 'CONFLICT', message: 'Conflict' },
      requestId: 'req-conflict-example',
    },
  ],
});
export const ApiUnprocessableEntityError = makeApiErrorSchema({
  code: 'UNPROCESSABLE_ENTITY',
  examples: [
    {
      error: { code: 'UNPROCESSABLE_ENTITY', message: 'Unprocessable Entity' },
      requestId: 'req-unprocessable-example',
    },
  ],
});
export const ApiTooManyRequestsError = makeApiErrorSchema({
  code: 'TOO_MANY_REQUESTS',
  details: RateLimitDetails,
  examples: [
    {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too Many Requests',
        details: {
          kind: 'rate_limit',
          retryAfterMs: 1000,
          retryAfterSec: 1,
        },
      },
      requestId: 'req-rate-limit-example',
    },
  ],
});
export const ApiInternalError = makeApiErrorSchema({
  code: 'INTERNAL',
  examples: [
    {
      error: { code: 'INTERNAL', message: 'Internal Server Error' },
      requestId: 'req-internal-example',
    },
  ],
});
