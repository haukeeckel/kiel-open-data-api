import { fetchDistrictsPopulation } from '../fetch_districts_population.js';
import { createEtlLogger } from '../../logger/etl.js';
import { flushLogger } from '../../logger/flush.js';
import { getEnv } from '../../config/env.js';

const log = createEtlLogger(getEnv().NODE_ENV);

async function main() {
  const res = await fetchDistrictsPopulation();
  log.info(res, 'etl.fetch: done');
}

main()
  .catch((err) => {
    log.error({ err }, 'etl.fetch: fatal');
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushLogger(log);
    process.exit();
  });
