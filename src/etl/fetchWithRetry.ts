const DEFAULT_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 500;
import { sleep } from '../utils/sleep';

const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: {
    retries?: number;
    initialDelayMs?: number;
    timeoutMs?: number;
    fetchFn?: typeof fetch;
  },
): Promise<Response> {
  const retries = opts?.retries ?? DEFAULT_RETRIES;
  const initialDelayMs = opts?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = opts?.fetchFn ?? fetch;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = initialDelayMs * 2 ** (attempt - 1);
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
