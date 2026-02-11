import { flushLogger } from '../../logger/flush.js';
import { DATASET } from '../districts_population.constants.js';
import { getEtlLogger } from '../etlLogger.js';
import { fetchDistrictsPopulation } from '../fetch_districts_population.js';

async function main() {
  const { log } = getEtlLogger('fetch', DATASET);
  const res = await fetchDistrictsPopulation();
  log.info(res, 'etl.fetch: done');
  await flushLogger(log);
}

main()
  .catch((err) => {
    const { log } = getEtlLogger('fetch', DATASET);
    log.error({ err }, 'etl.fetch: fatal');
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
