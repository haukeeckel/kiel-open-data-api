import { flushLogger } from '../../logger/flush.js';
import { DATASET } from '../districts_population.constants.js';
import { getEtlLogger } from '../etlLogger.js';
import { importDistrictsPopulation } from '../import_districts_population.js';

async function main() {
  const { log } = getEtlLogger('import', DATASET);
  const res = await importDistrictsPopulation();
  log.info(res, 'etl.import: done');
  await flushLogger(log);
}

main()
  .catch((err) => {
    const { log } = getEtlLogger('import', DATASET);
    log.error({ err }, 'etl.import: fatal');
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
