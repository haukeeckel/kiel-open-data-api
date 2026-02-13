import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../logger/flush.js', () => ({
  flushLogger: vi.fn(async () => undefined),
}));

vi.mock('../etlLogger.js', () => ({
  getEtlLogger: vi.fn(() => ({ log, ctx: {} })),
}));

vi.mock('../fetchDataset.js', () => ({
  fetchDataset: vi.fn(async () => ({ updated: true, path: '/tmp/test.csv' })),
}));

vi.mock('../importDataset.js', () => ({
  importDataset: vi.fn(async () => ({
    imported: 1,
    csvPath: '/tmp/test.csv',
    dbPath: '/tmp/test.duckdb',
  })),
}));

import { DISTRICTS_POPULATION } from '../datasets/districts_population.js';
import { fetchDataset } from '../fetchDataset.js';
import { importDataset } from '../importDataset.js';

import { runCli } from './run.js';

describe('etl run cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes retry flags to fetchDataset', async () => {
    const exitCode = await runCli([
      DISTRICTS_POPULATION.id,
      '--retries',
      '4',
      '--base-delay-ms',
      '10',
      '--max-delay-ms=20',
      '--timeout-ms=30',
    ]);

    expect(exitCode).toBe(0);
    expect(fetchDataset).toHaveBeenCalledWith(
      expect.objectContaining({ id: DISTRICTS_POPULATION.id }),
      {
        retries: 4,
        baseDelayMs: 10,
        maxDelayMs: 20,
        timeoutMs: 30,
      },
    );
  });

  it('warns and continues when csv is missing during import', async () => {
    vi.mocked(importDataset).mockRejectedValueOnce(
      new Error('CSV file not found: /tmp/missing.csv'),
    );

    const exitCode = await runCli([DISTRICTS_POPULATION.id]);

    expect(exitCode).toBe(0);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: DISTRICTS_POPULATION.id }),
      'etl.run: import skipped (csv missing)',
    );
  });

  it('fails on non-csv import errors', async () => {
    vi.mocked(importDataset).mockRejectedValueOnce(new Error('boom'));

    const exitCode = await runCli([DISTRICTS_POPULATION.id]);

    expect(exitCode).toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'etl.run: fatal',
    );
  });
});
