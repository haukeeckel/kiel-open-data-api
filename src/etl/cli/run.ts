import { flushLogger } from '../../logger/flush.js';
import { getAllDatasets, getAllDatasetIds, getDataset } from '../datasets/registry.js';
import { getEtlLogger } from '../etlLogger.js';
import { fetchDataset } from '../fetchDataset.js';
import { importDataset } from '../importDataset.js';

function usage() {
  return `Usage: tsx src/etl/cli/run.ts <dataset-id> | --all\nKnown datasets: ${getAllDatasetIds().join(', ')}`;
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
  const { log } = getEtlLogger('fetch', 'cli');
  try {
    const datasets = resolveDatasets(process.argv.slice(2));

    for (const dataset of datasets) {
      const fetchRes = await fetchDataset(dataset);
      log.info({ dataset: dataset.id, ...fetchRes }, 'etl.run: fetch done');

      const importRes = await importDataset(dataset);
      log.info({ dataset: dataset.id, ...importRes }, 'etl.run: import done');
    }

    await flushLogger(log);
    process.exit(0);
  } catch (err) {
    log.error({ err }, 'etl.run: fatal');
    await flushLogger(log);
    process.exit(1);
  }
}

void main();
