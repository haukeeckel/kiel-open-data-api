import { pino, type Logger } from 'pino';
import type { NodeEnv } from '../constants';

export function createEtlLogger(nodeEnv: NodeEnv): Logger {
  if (nodeEnv === 'test') return pino({ enabled: false });

  const loggerName = 'etl';

  if (nodeEnv === 'production') return pino({ name: loggerName, level: 'info' });

  return pino({
    name: loggerName,
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  });
}
