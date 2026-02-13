import { flushLogger } from '../../logger/flush.js';
import { getEtlLogger } from '../etlLogger.js';
import { importDataset } from '../importDataset.js';

import { buildUsage, isDirectCliEntry, parseCliArgs } from './shared.js';

export async function runCli(argv: readonly string[]): Promise<number> {
  const { log } = getEtlLogger('import', 'cli');
  try {
    const { datasets } = parseCliArgs(argv, { scriptName: 'import.ts' });

    for (const dataset of datasets) {
      try {
        const res = await importDataset(dataset);
        log.info({ dataset: dataset.id, ...res }, 'etl.import: done');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('CSV file not found:')) {
          log.warn({ dataset: dataset.id, err }, 'etl.import: skipped (csv missing)');
          continue;
        }
        throw err;
      }
    }

    await flushLogger(log);
    return 0;
  } catch (err) {
    log.error({ err }, 'etl.import: fatal');
    log.info({ usage: buildUsage('import.ts') }, 'etl.import: usage');
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
