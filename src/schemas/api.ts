import z from 'zod';

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  requestId: z.string(),
});
