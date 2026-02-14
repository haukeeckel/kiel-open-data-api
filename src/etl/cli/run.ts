import { flushLogger } from '../../logger/flush.js';
import { CsvFileNotFoundError } from '../errors.js';
import { getEtlLogger } from '../etlLogger.js';
import { fetchDataset } from '../fetchDataset.js';
import { importDataset } from '../importDataset.js';

import { buildUsage, isDirectCliEntry, parseCliArgs } from './shared.js';

const RUN_NUMERIC_FLAGS = ['retries', 'base-delay-ms', 'max-delay-ms', 'timeout-ms'] as const;

export async function runCli(argv: readonly string[]): Promise<number> {
  const { log } = getEtlLogger('run', 'cli');
  try {
    const { datasets, numericFlags } = parseCliArgs(argv, {
      scriptName: 'run.ts',
      numericFlags: RUN_NUMERIC_FLAGS,
    });

    for (const dataset of datasets) {
      const fetchRes = await fetchDataset(dataset, {
        retries: numericFlags['retries'],
        baseDelayMs: numericFlags['base-delay-ms'],
        maxDelayMs: numericFlags['max-delay-ms'],
        timeoutMs: numericFlags['timeout-ms'],
      });
      log.info({ dataset: dataset.id, ...fetchRes }, 'etl.run: fetch done');

      try {
        const importRes = await importDataset(dataset);
        log.info({ dataset: dataset.id, ...importRes }, 'etl.run: import done');
      } catch (err) {
        if (err instanceof CsvFileNotFoundError) {
          log.warn({ dataset: dataset.id, err }, 'etl.run: import skipped (csv missing)');
          continue;
        }
        throw err;
      }
    }

    await flushLogger(log);
    return 0;
  } catch (err) {
    log.error({ err }, 'etl.run: fatal');
    log.info({ usage: buildUsage('run.ts', RUN_NUMERIC_FLAGS) }, 'etl.run: usage');
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
