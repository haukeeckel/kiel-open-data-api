import { fetchDistrictsPopulation } from '../fetch_districts_population';
import { createEtlLogger } from '../../logger/etl';
import { flushLogger } from '../../logger/flush';
import { getEnv } from '../../config/env';

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
