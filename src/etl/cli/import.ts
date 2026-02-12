import { flushLogger } from '../../logger/flush.js';
import { getAllDatasets, getAllDatasetIds, getDataset } from '../datasets/registry.js';
import { getEtlLogger } from '../etlLogger.js';
import { importDataset } from '../importDataset.js';

function usage() {
  return `Usage: tsx src/etl/cli/import.ts <dataset-id> | --all\nKnown datasets: ${getAllDatasetIds().join(', ')}`;
}

function resolveDatasets(argv: readonly string[]) {
  if (argv.length === 1) {
    const [arg] = argv;
    if (arg === '--all') return getAllDatasets();
    if (arg) return [getDataset(arg)];
  }
  throw new Error(usage());
}

async function main() {
  const { log } = getEtlLogger('import', 'cli');
  try {
    const datasets = resolveDatasets(process.argv.slice(2));

    for (const dataset of datasets) {
      const res = await importDataset(dataset);
      log.info({ dataset: dataset.id, ...res }, 'etl.import: done');
    }

    await flushLogger(log);
    process.exit(0);
  } catch (err) {
    log.error({ err }, 'etl.import: fatal');
    await flushLogger(log);
    process.exit(1);
  }
}

void main();
