import type { FastifyServerOptions } from 'fastify';
import { type NodeEnv } from '../config/constants';

type LoggerOption = Exclude<FastifyServerOptions['logger'], undefined>;

export function getLoggerOptions(nodeEnv: NodeEnv): LoggerOption {
  if (nodeEnv === 'test') return false;
  if (nodeEnv === 'production') return true;

  return {
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  };
}
