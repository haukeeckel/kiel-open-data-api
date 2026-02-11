import { DEFAULT_RETRIES, type RetryConfig } from '../config/retry.js';
import { sleep } from '../utils/sleep.js';

const defaults: RetryConfig = {
  retries: DEFAULT_RETRIES,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
};

export type FetchRetryOptions = Partial<RetryConfig> & {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: FetchRetryOptions,
): Promise<Response> {
  const { retries, baseDelayMs, maxDelayMs } = { ...defaults, ...opts };
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const fetchFn = opts?.fetchFn ?? fetch;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay);
    }

    try {
      const res = await fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status >= 500 && attempt < retries) {
        lastError = new Error(`Server error: ${res.status} ${res.statusText}`);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
    }
  }

  throw lastError;
}
