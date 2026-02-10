import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type buildServer } from '../server';
import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app';

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

  it('GET / returns endpoint list', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'kiel-dashboard-api' });
  });
});
