import { type NodeEnv } from '../config/constants.js';

import type { FastifyServerOptions } from 'fastify';

type LoggerOption = Exclude<FastifyServerOptions['logger'], undefined>;

export function getLoggerOptions(nodeEnv: NodeEnv): LoggerOption {
  if (nodeEnv === 'test') return false;
  if (nodeEnv === 'production') return true;

  return {
    name: 'server',
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  };
}
