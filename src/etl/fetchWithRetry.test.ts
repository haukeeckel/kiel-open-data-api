import { describe, expect, it, vi } from 'vitest';

import { fetchWithRetry, type FetchRetryOptions } from './fetchWithRetry.js';

const TEST_URL = 'https://example.com/data.csv';
const FAST: FetchRetryOptions = { retries: 2, baseDelayMs: 1, timeoutMs: 5000 };

function mockFetch(...responses: Array<Response | Error>) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Error) {
      fn.mockRejectedValueOnce(r);
    } else {
      fn.mockResolvedValueOnce(r);
    }
  }
  return fn;
}

describe('fetchWithRetry', () => {
  it('returns response on first success', async () => {
    const fn = mockFetch(new Response('ok', { status: 200 }));

    const res = await fetchWithRetry(TEST_URL, undefined, { ...FAST, fetchFn: fn });

    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error and succeeds', async () => {
    const fn = mockFetch(new Error('ECONNRESET'), new Response('ok', { status: 200 }));

    const res = await fetchWithRetry(TEST_URL, undefined, { ...FAST, fetchFn: fn });

    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 and succeeds', async () => {
    const fn = mockFetch(
      new Response('unavailable', { status: 503, statusText: 'Service Unavailable' }),
      new Response('ok', { status: 200 }),
    );

    const res = await fetchWithRetry(TEST_URL, undefined, { ...FAST, fetchFn: fn });

    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries exhausted', async () => {
    const fn = mockFetch(new Error('fail 1'), new Error('fail 2'), new Error('fail 3'));

    await expect(fetchWithRetry(TEST_URL, undefined, { ...FAST, fetchFn: fn })).rejects.toThrow(
      'fail 3',
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 4xx', async () => {
    const fn = mockFetch(new Response('bad request', { status: 400, statusText: 'Bad Request' }));

    const res = await fetchWithRetry(TEST_URL, undefined, { ...FAST, fetchFn: fn });

    expect(res.status).toBe(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 304', async () => {
    const fn = mockFetch(new Response(null, { status: 304, statusText: 'Not Modified' }));

    const res = await fetchWithRetry(TEST_URL, undefined, { ...FAST, fetchFn: fn });

    expect(res.status).toBe(304);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns 5xx response when retries exhausted', async () => {
    const fn = mockFetch(
      new Response('err', { status: 500, statusText: 'Internal Server Error' }),
      new Response('err', { status: 500, statusText: 'Internal Server Error' }),
      new Response('err', { status: 500, statusText: 'Internal Server Error' }),
    );

    const res = await fetchWithRetry(TEST_URL, undefined, { ...FAST, fetchFn: fn });

    expect(res.status).toBe(500);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
