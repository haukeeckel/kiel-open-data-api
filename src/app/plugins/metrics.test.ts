import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetMetricsForTests } from '../../observability/metrics.js';
import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { makeEnv } from '../../test/helpers/makeEnv.js';
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
    expect(res.body).toMatch(
      /http_requests_total\{method="GET",route="<not_found>",status="404"\}/,
    );
  });

  it('does not expose metrics endpoint when disabled', async () => {
    const disabled = await makeAppAndSeed({
      env: {
        METRICS_ENABLED: false,
      },
    });

    try {
      const res = await disabled.app.inject({ method: 'GET', url: '/metrics' });
      expect(res.statusCode).toBe(404);
    } finally {
      await disabled.app.close();
      cleanupDuckDbFiles(disabled.dbPath);
    }
  });

  it('returns 401 when metrics token is required but missing', async () => {
    const guarded = await makeAppAndSeed({
      env: {
        METRICS_ENABLED: true,
        METRICS_TOKEN: 'secret',
      },
    });

    try {
      const res = await guarded.app.inject({ method: 'GET', url: '/metrics' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing metrics authentication token',
        },
      });
    } finally {
      await guarded.app.close();
      cleanupDuckDbFiles(guarded.dbPath);
    }
  });

  it('returns 403 when metrics token is invalid', async () => {
    const guarded = await makeAppAndSeed({
      env: {
        METRICS_ENABLED: true,
        METRICS_TOKEN: 'secret',
      },
    });

    try {
      const res = await guarded.app.inject({
        method: 'GET',
        url: '/metrics',
        headers: {
          'x-metrics-token': 'wrong',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid metrics authentication token',
        },
      });
    } finally {
      await guarded.app.close();
      cleanupDuckDbFiles(guarded.dbPath);
    }
  });

  it('serves metrics when token is valid', async () => {
    const guarded = await makeAppAndSeed({
      env: {
        METRICS_ENABLED: true,
        METRICS_TOKEN: 'secret',
      },
    });

    try {
      const res = await guarded.app.inject({
        method: 'GET',
        url: '/metrics',
        headers: {
          'x-metrics-token': 'secret',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/i);
    } finally {
      await guarded.app.close();
      cleanupDuckDbFiles(guarded.dbPath);
    }
  });

  it('supports custom metrics auth header name', async () => {
    const guarded = await makeAppAndSeed({
      env: {
        METRICS_ENABLED: true,
        METRICS_TOKEN: 'secret',
        METRICS_AUTH_HEADER: 'x-observability-token',
      },
    });

    try {
      const res = await guarded.app.inject({
        method: 'GET',
        url: '/metrics',
        headers: {
          'x-observability-token': 'secret',
        },
      });
      expect(res.statusCode).toBe(200);
    } finally {
      await guarded.app.close();
      cleanupDuckDbFiles(guarded.dbPath);
    }
  });

  it('keeps plugin contract compatible with explicit env object', async () => {
    const env = makeEnv({
      METRICS_ENABLED: true,
      METRICS_TOKEN: undefined,
    });
    expect(env.METRICS_ENABLED).toBe(true);
  });
});
