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

vi.mock('../importDataset.js', () => ({
  importDataset: vi.fn(async () => ({
    imported: 1,
    csvPath: '/tmp/test.csv',
    dbPath: '/tmp/test.duckdb',
  })),
}));

import { DISTRICTS_POPULATION } from '../datasets/districts_population.js';
import { CsvFileNotFoundError } from '../errors.js';
import { importDataset } from '../importDataset.js';

import { runCli } from './import.js';

describe('etl import cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports selected dataset successfully', async () => {
    const exitCode = await runCli([DISTRICTS_POPULATION.id]);

    expect(exitCode).toBe(0);
    expect(importDataset).toHaveBeenCalledWith(
      expect.objectContaining({ id: DISTRICTS_POPULATION.id }),
    );
  });

  it('warns and continues when csv is missing', async () => {
    vi.mocked(importDataset).mockRejectedValueOnce(new CsvFileNotFoundError('/tmp/missing.csv'));

    const exitCode = await runCli([DISTRICTS_POPULATION.id]);

    expect(exitCode).toBe(0);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: DISTRICTS_POPULATION.id }),
      'etl.import: skipped (csv missing)',
    );
  });

  it('fails on migration boundary errors and does not skip', async () => {
    vi.mocked(importDataset).mockRejectedValueOnce(
      new Error('Database schema is inconsistent. Run "pnpm migrate" before starting the app.'),
    );

    const exitCode = await runCli([DISTRICTS_POPULATION.id]);

    expect(exitCode).toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'etl.import: fatal',
    );
    expect(log.warn).not.toHaveBeenCalledWith(
      expect.anything(),
      'etl.import: skipped (csv missing)',
    );
  });
});
