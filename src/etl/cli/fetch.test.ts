import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = createCliTestLogger();

vi.mock('../../logger/flush.js', () => ({
  flushLogger: vi.fn(async () => undefined),
}));

vi.mock('../etlLogger.js', () => ({
  getEtlLogger: vi.fn(() => ({ log, ctx: {} })),
}));

vi.mock('../fetchDataset.js', () => ({
  fetchDataset: vi.fn(async () => ({ updated: true, path: '/tmp/test.csv' })),
}));

import { createCliTestLogger } from '../../test/fixtures/cliLogger.fixtures.js';
import { DISTRICTS_POPULATION } from '../datasets/districts_population.js';
import { fetchDataset } from '../fetchDataset.js';

import { runCli } from './fetch.js';

describe('etl fetch cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes retry flags to fetchDataset', async () => {
    const exitCode = await runCli([
      DISTRICTS_POPULATION.id,
      '--retries=4',
      '--base-delay-ms',
      '10',
      '--max-delay-ms',
      '20',
      '--timeout-ms',
      '30',
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
});
