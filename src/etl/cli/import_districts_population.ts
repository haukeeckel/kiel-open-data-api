import { getEnv } from '../../config/env.js';
import { createEtlLogger } from '../../logger/etl.js';
import { flushLogger } from '../../logger/flush.js';
import { importDistrictsPopulation } from '../import_districts_population.js';

const log = createEtlLogger(getEnv().NODE_ENV);

async function main() {
  const res = await importDistrictsPopulation();
  log.info(res, 'etl.import: done');
}

main()
  .catch((err) => {
    log.error({ err }, 'etl.import: fatal');
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushLogger(log);
    process.exit();
  });
