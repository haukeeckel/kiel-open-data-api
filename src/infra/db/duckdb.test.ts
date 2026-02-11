import { DuckDBInstance } from '@duckdb/node-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sleep } from '../../utils/sleep.js';

import { createDb } from './duckdb.js';

vi.mock('@duckdb/node-api', () => ({
  DuckDBInstance: {
    create: vi.fn(),
  },
}));

vi.mock('../../utils/sleep.js', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

describe('createDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns db on first attempt', async () => {
    const db = { ok: true };
    (DuckDBInstance.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const info = vi.fn();
    const result = await createDb('/tmp/kiel-test.duckdb', { logger: { info } });

    expect(result).toBe(db);
    expect(DuckDBInstance.create).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ dbPath: '/tmp/kiel-test.duckdb' }),
      'duckdb: create start',
    );
  });

  it('retries with backoff and succeeds', async () => {
    const db = { ok: true };
    (DuckDBInstance.create as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('nope'))
      .mockRejectedValueOnce(new Error('still nope'))
      .mockResolvedValueOnce(db);

    const warn = vi.fn();

    const result = await createDb('/tmp/kiel-retry.duckdb', {
      retries: 2,
      baseDelayMs: 1,
      maxDelayMs: 2,
      logger: { warn },
    });

    expect(result).toBe(db);
    expect(DuckDBInstance.create).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 1);
    expect(sleep).toHaveBeenNthCalledWith(2, 2);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('throws after retries are exhausted', async () => {
    (DuckDBInstance.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('nope'),
    );

    const error = vi.fn();

    await expect(
      createDb('/tmp/kiel-fail.duckdb', { retries: 1, logger: { error } }),
    ).rejects.toThrow(/nope/i);

    expect(DuckDBInstance.create).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 2, dbPath: '/tmp/kiel-fail.duckdb' }),
      'duckdb: create failed after retries',
    );
  });
});
