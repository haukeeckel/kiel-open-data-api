import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_NAME } from '../../config/constants.js';
import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { type buildServer } from '../server.js';

describe('api smoke', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let dbPath: string;

  beforeEach(async () => {
    const res = await makeAppAndSeed();
    app = res.app;
    dbPath = res.dbPath;
  });

  afterEach(async () => {
    await app.close();
    cleanupDuckDbFiles(dbPath);
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, db: 'up' });
  });

  it('GET /health returns 503 when db is down', async () => {
    const original = app.dbManager.healthcheck;
    app.dbManager.healthcheck = async () => false;
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ ok: false, db: 'down' });
    } finally {
      app.dbManager.healthcheck = original;
    }
  });

  it('GET /health recovers after temporary db outage', async () => {
    const original = app.dbManager.healthcheck;
    let call = 0;
    app.dbManager.healthcheck = async () => {
      call += 1;
      return call > 1;
    };
    try {
      const first = await app.inject({ method: 'GET', url: '/health' });
      expect(first.statusCode).toBe(503);
      expect(first.json()).toMatchObject({ ok: false, db: 'down' });

      const second = await app.inject({ method: 'GET', url: '/health' });
      expect(second.statusCode).toBe(200);
      expect(second.json()).toMatchObject({ ok: true, db: 'up' });
    } finally {
      app.dbManager.healthcheck = original;
    }
  });

  it('GET / returns endpoint list', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: API_NAME });
  });
});
