import { flushLogger } from '../../logger/flush.js';
import { getEtlLogger } from '../etlLogger.js';
import { fetchDataset } from '../fetchDataset.js';

import { buildUsage, isDirectCliEntry, parseCliArgs } from './shared.js';

const FETCH_NUMERIC_FLAGS = ['retries', 'base-delay-ms', 'max-delay-ms', 'timeout-ms'] as const;

export async function runCli(argv: readonly string[]): Promise<number> {
  const { log } = getEtlLogger('fetch', 'cli');
  try {
    const { datasets, numericFlags } = parseCliArgs(argv, {
      scriptName: 'fetch.ts',
      numericFlags: FETCH_NUMERIC_FLAGS,
    });

    for (const dataset of datasets) {
      const res = await fetchDataset(dataset, {
        retries: numericFlags['retries'],
        baseDelayMs: numericFlags['base-delay-ms'],
        maxDelayMs: numericFlags['max-delay-ms'],
        timeoutMs: numericFlags['timeout-ms'],
      });
      log.info({ dataset: dataset.id, ...res }, 'etl.fetch: done');
    }

    await flushLogger(log);
    return 0;
  } catch (err) {
    log.error({ err }, 'etl.fetch: fatal');
    log.info({ usage: buildUsage('fetch.ts', FETCH_NUMERIC_FLAGS) }, 'etl.fetch: usage');
    await flushLogger(log);
    return 1;
  }
}

async function main() {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}

if (isDirectCliEntry(import.meta.url)) {
  void main();
}
