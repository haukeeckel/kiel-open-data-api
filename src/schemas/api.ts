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

export const ApiError = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    details: z
      .union([
        z.array(ValidationDetailItem),
        DomainValidationDetails,
        RateLimitDetails,
        FallbackDetails,
      ])
      .optional(),
  }),
  requestId: z.string(),
});
