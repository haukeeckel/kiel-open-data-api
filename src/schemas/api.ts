import { z } from 'zod';

import { API_ERROR_CODES } from '../app/http/errors.js';

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
}) {
  const { code, details } = args;
  return z.object({
    error: z.object({
      code: z.literal(code),
      message: z.string(),
      ...(details !== undefined ? { details: details.optional() } : {}),
    }),
    requestId: z.string(),
  });
}

export const ApiError = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    details: ApiErrorDetails,
  }),
  requestId: z.string(),
});

export const ApiBadRequestError = makeApiErrorSchema({
  code: 'BAD_REQUEST',
  details: z.union([z.array(ValidationDetailItem), DomainValidationDetails, FallbackDetails]),
});
export const ApiUnauthorizedError = makeApiErrorSchema({ code: 'UNAUTHORIZED' });
export const ApiForbiddenError = makeApiErrorSchema({ code: 'FORBIDDEN' });
export const ApiNotFoundError = makeApiErrorSchema({ code: 'NOT_FOUND' });
export const ApiConflictError = makeApiErrorSchema({ code: 'CONFLICT' });
export const ApiUnprocessableEntityError = makeApiErrorSchema({ code: 'UNPROCESSABLE_ENTITY' });
export const ApiTooManyRequestsError = makeApiErrorSchema({
  code: 'TOO_MANY_REQUESTS',
  details: RateLimitDetails,
});
export const ApiInternalError = makeApiErrorSchema({ code: 'INTERNAL' });
