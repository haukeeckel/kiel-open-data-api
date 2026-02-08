export const ApiErrorSchema = {
  $id: 'ApiError',
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', enum: ['BAD_REQUEST', 'NOT_FOUND', 'INTERNAL'] },
        message: { type: 'string' },
        details: {}, // intentionally open
      },
      required: ['code', 'message'],
    },
    requestId: { type: 'string' },
  },
  required: ['error', 'requestId'],
};
