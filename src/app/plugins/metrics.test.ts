import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetMetricsForTests } from '../../observability/metrics.js';
import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { type buildServer } from '../server.js';

describe('metrics plugin', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let dbPath: string;

  beforeEach(async () => {
    resetMetricsForTests();
    const res = await makeAppAndSeed();
    app = res.app;
    dbPath = res.dbPath;
  });

  afterEach(async () => {
    await app.close();
    cleanupDuckDbFiles(dbPath);
    resetMetricsForTests();
  });

  it('serves prometheus metrics and tracks route-based request metrics', async () => {
    await app.inject({ method: 'GET', url: '/health' });
    await app.inject({ method: 'GET', url: '/v1/indicators' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/i);

    const body = res.body;
    expect(body).toContain('http_requests_total');
    expect(body).toContain('http_request_duration_seconds');
    expect(body).toMatch(/http_requests_total\{method="GET",route="\/health",status="200"\}/);
    expect(body).toMatch(
      /http_requests_total\{method="GET",route="(?:\/v1)?\/indicators",status="200"\}/,
    );
    expect(body).not.toMatch(/route="\/metrics"/);
  });

  it('tracks error responses with status labels', async () => {
    await app.inject({ method: 'GET', url: '/does-not-exist' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/http_requests_total\{method="GET",route="<unknown>",status="404"\}/);
  });
});
