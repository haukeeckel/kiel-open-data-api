import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/path.js', () => ({
  getDuckDbPath: vi.fn(() => '/tmp/kiel-test.duckdb'),
}));

vi.mock('../../infra/db/duckdbConnectionManager.js', () => ({
  createDuckDbConnectionManager: vi.fn(),
}));

vi.mock('../../infra/db/migrations.js', () => ({
  assertMigrationsUpToDate: vi.fn(),
}));

vi.mock('../../infra/db/statisticsRepository.duckdb.js', () => ({
  createDuckDbStatisticsRepository: vi.fn(),
}));

import { getDuckDbPath } from '../../config/path.js';
import { createDuckDbConnectionManager } from '../../infra/db/duckdbConnectionManager.js';
import { assertMigrationsUpToDate } from '../../infra/db/migrations.js';
import { createDuckDbStatisticsRepository } from '../../infra/db/statisticsRepository.duckdb.js';
import { makeEnv } from '../../test/helpers/makeEnv.js';

import repositoriesPlugin from './repositories.js';

import type { DuckDBConnection } from '@duckdb/node-api';

describe('repositories plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates db, checks schema version, and decorates repos', async () => {
    const env = makeEnv({ NODE_ENV: 'test' });

    const conn = { run: vi.fn() } as unknown as DuckDBConnection;
    const dbManager = {
      withConnection: vi.fn(async (fn: (conn: DuckDBConnection) => Promise<void>) => fn(conn)),
      healthcheck: vi.fn(async () => true),
      close: vi.fn(async () => undefined),
    };
    const repo = { listAreas: vi.fn() };

    (createDuckDbConnectionManager as ReturnType<typeof vi.fn>).mockReturnValue(dbManager);
    (createDuckDbStatisticsRepository as ReturnType<typeof vi.fn>).mockReturnValue(repo);

    const app = Fastify();
    await app.register(repositoriesPlugin, { env });

    expect(getDuckDbPath).toHaveBeenCalled();
    expect(createDuckDbConnectionManager).toHaveBeenCalledWith({
      dbPath: '/tmp/kiel-test.duckdb',
      poolSize: 4,
      logger: expect.any(Object),
    });
    expect(dbManager.withConnection).toHaveBeenCalledWith(assertMigrationsUpToDate);
    expect(assertMigrationsUpToDate).toHaveBeenCalledWith(conn);
    expect(createDuckDbStatisticsRepository).toHaveBeenCalledWith(dbManager, {
      queryTimeoutMs: 2000,
      logger: expect.any(Object),
    });
    expect(app.repos.statisticsRepository).toBe(repo);
    expect(app.dbManager).toBe(dbManager);

    await app.close();
    expect(dbManager.close).toHaveBeenCalled();
  });

  it('fails registration when schema is out of date', async () => {
    const env = makeEnv({ NODE_ENV: 'test' });
    const err = new Error('Database schema is out of date');

    const dbManager = {
      withConnection: vi.fn(async () => {
        throw err;
      }),
      healthcheck: vi.fn(async () => true),
      close: vi.fn(async () => undefined),
    };

    (createDuckDbConnectionManager as ReturnType<typeof vi.fn>).mockReturnValue(dbManager);

    const app = Fastify();
    await expect(app.register(repositoriesPlugin, { env })).rejects.toThrow(err.message);
    await app.close();
  });
});
