import { getEnv } from '../config/env.js';
import { createEtlLogger } from '../logger/etl.js';

import type { EtlContext } from './etlContext.js';
import type { Logger } from 'pino';

export function getEtlLogger(
  step: EtlContext['step'],
  dataset: string,
): {
  log: Logger;
  ctx: EtlContext;
} {
  return {
    log: createEtlLogger(getEnv().NODE_ENV),
    ctx: { dataset, step },
  };
}
