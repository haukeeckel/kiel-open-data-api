import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

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
  assertMigrationsUpToDate: vi.fn(),
}));

vi.mock('../../logger/flush.js', () => ({
  flushLogger: vi.fn(async () => undefined),
}));

vi.mock('../etlLogger.js', () => ({
  getEtlLogger: vi.fn(() => ({ log, ctx: {} })),
}));

import { getEnv } from '../../config/env.js';
import { getDuckDbPath } from '../../config/path.js';
import { createDb } from '../../infra/db/duckdb.js';
import { assertMigrationsUpToDate } from '../../infra/db/migrations.js';
import { flushLogger } from '../../logger/flush.js';
import { makeEnv } from '../../test/helpers/makeEnv.js';

import { runCli } from './maint.js';

import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

describe('etl maint cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 and logs dry-run plan', async () => {
    const env = makeEnv({ NODE_ENV: 'test' });
    const conn = {
      runAndReadAll: vi.fn(async () => ({
        getRowObjects: () => [{ total_runs: 10, failed_runs: 2, published_runs: 8 }],
      })),
      closeSync: vi.fn(),
    } as unknown as DuckDBConnection;
    const db = {
      connect: vi.fn(async () => conn),
      closeSync: vi.fn(),
    } as unknown as DuckDBInstance;

    vi.mocked(getEnv).mockReturnValue(env);
    vi.mocked(getDuckDbPath).mockReturnValue('/tmp/test.duckdb');
    vi.mocked(createDb).mockResolvedValue(db);

    const exitCode = await runCli(['--dry-run']);

    expect(exitCode).toBe(0);
    expect(assertMigrationsUpToDate).toHaveBeenCalledWith(conn);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'dry-run',
        summary: { totalRuns: 10, failedRuns: 2, publishedRuns: 8 },
      }),
      'etl.maint: dry-run plan',
    );
    expect(flushLogger).toHaveBeenCalledWith(log);
  });

  it('returns 1 for invalid args', async () => {
    const exitCode = await runCli(['--invalid']);

    expect(exitCode).toBe(1);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ usage: expect.stringContaining('maint.ts --dry-run') }),
      'etl.maint: usage',
    );
  });
});
