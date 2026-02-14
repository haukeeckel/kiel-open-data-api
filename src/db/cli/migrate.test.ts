import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = createCliTestLogger();

vi.mock('../../config/env.js', () => ({
  getEnv: vi.fn(),
}));

vi.mock('../../config/path.js', () => ({
  getDuckDbPath: vi.fn(),
}));

vi.mock('../../infra/db/duckdb.js', () => ({
  createDb: vi.fn(),
}));

vi.mock('../../infra/db/migrations.js', () => ({
  applyMigrations: vi.fn(),
}));

vi.mock('../../logger/etl.js', () => ({
  createEtlLogger: vi.fn(() => log),
}));

vi.mock('../../logger/flush.js', () => ({
  flushLogger: vi.fn(async () => undefined),
}));

import { getEnv } from '../../config/env.js';
import { getDuckDbPath } from '../../config/path.js';
import { createDb } from '../../infra/db/duckdb.js';
import { applyMigrations } from '../../infra/db/migrations.js';
import { flushLogger } from '../../logger/flush.js';
import { createCliTestLogger } from '../../test/fixtures/cliLogger.fixtures.js';
import { makeEnv } from '../../test/helpers/makeEnv.js';

import { runCli } from './migrate.js';

import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

describe('db migrate cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when migrations succeed', async () => {
    const env = makeEnv({ NODE_ENV: 'test' });
    const conn = { closeSync: vi.fn() } as unknown as DuckDBConnection;
    const db = {
      connect: vi.fn(async () => conn),
      closeSync: vi.fn(),
    } as unknown as DuckDBInstance;

    vi.mocked(getEnv).mockReturnValue(env);
    vi.mocked(getDuckDbPath).mockReturnValue('/tmp/test.duckdb');
    vi.mocked(createDb).mockResolvedValue(db);

    const exitCode = await runCli();

    expect(exitCode).toBe(0);
    expect(createDb).toHaveBeenCalledWith('/tmp/test.duckdb', { logger: log });
    expect(applyMigrations).toHaveBeenCalledWith(conn);
    expect(conn.closeSync).toHaveBeenCalled();
    expect(db.closeSync).toHaveBeenCalled();
    expect(flushLogger).toHaveBeenCalledWith(log);
  });

  it('returns 1 when migrations fail and still closes resources', async () => {
    const env = makeEnv({ NODE_ENV: 'test' });
    const conn = { closeSync: vi.fn() } as unknown as DuckDBConnection;
    const db = {
      connect: vi.fn(async () => conn),
      closeSync: vi.fn(),
    } as unknown as DuckDBInstance;

    vi.mocked(getEnv).mockReturnValue(env);
    vi.mocked(getDuckDbPath).mockReturnValue('/tmp/test.duckdb');
    vi.mocked(createDb).mockResolvedValue(db);
    vi.mocked(applyMigrations).mockRejectedValue(new Error('boom'));

    const exitCode = await runCli();

    expect(exitCode).toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), dbPath: '/tmp/test.duckdb' }),
      'db.migrate: failed',
    );
    expect(conn.closeSync).toHaveBeenCalled();
    expect(db.closeSync).toHaveBeenCalled();
    expect(flushLogger).toHaveBeenCalledWith(log);
  });
});
