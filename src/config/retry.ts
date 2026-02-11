export type RetryConfig = {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_RETRIES = 3;
