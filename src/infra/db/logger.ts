import type { Logger } from 'pino';

export type DbLogger = Partial<Pick<Logger, 'info' | 'warn' | 'error'>>;
