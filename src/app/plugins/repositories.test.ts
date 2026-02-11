import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/path.js', () => ({
  getDuckDbPath: vi.fn(() => '/tmp/kiel-test.duckdb'),
}));

vi.mock('../../infra/db/duckdb.js', () => ({
  createDb: vi.fn(),
}));

vi.mock('../../infra/db/migrations.js', () => ({
  applyMigrations: vi.fn(),
}));

vi.mock('../../infra/db/statisticsRepository.duckdb.js', () => ({
  createDuckDbStatisticsRepository: vi.fn(),
}));

import { getDuckDbPath } from '../../config/path.js';
import { createDb } from '../../infra/db/duckdb.js';
import { applyMigrations } from '../../infra/db/migrations.js';
import { createDuckDbStatisticsRepository } from '../../infra/db/statisticsRepository.duckdb.js';
import { makeEnv } from '../../test/helpers/makeEnv.js';

import repositoriesPlugin from './repositories.js';

describe('repositories plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates db, applies migrations, and decorates repos', async () => {
    const env = makeEnv({ NODE_ENV: 'test' });

    const conn = { closeSync: vi.fn() };
    const db = { connect: vi.fn().mockResolvedValue(conn), closeSync: vi.fn() };
    const repo = { listAreas: vi.fn() };

    (createDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);
    (createDuckDbStatisticsRepository as ReturnType<typeof vi.fn>).mockReturnValue(repo);

    const app = Fastify();
    await app.register(repositoriesPlugin, { env });

    expect(getDuckDbPath).toHaveBeenCalled();
    expect(createDb).toHaveBeenCalledWith('/tmp/kiel-test.duckdb', expect.any(Object));
    expect(db.connect).toHaveBeenCalled();
    expect(applyMigrations).toHaveBeenCalledWith(conn);
    expect(app.repos.statisticsRepository).toBe(repo);
    expect(app.dbConn).toBe(conn);

    await app.close();
    expect(conn.closeSync).toHaveBeenCalled();
    expect(db.closeSync).toHaveBeenCalled();
  });
});
