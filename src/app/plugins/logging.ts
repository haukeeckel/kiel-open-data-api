import { type NodeEnv } from '../../config/constants';
import { getLoggerOptions } from '../../logger/http';

export function buildHttpLogger(nodeEnv: NodeEnv) {
  return getLoggerOptions(nodeEnv);
}
