import { describe, expect, it } from 'vitest';
import { getLoggerOptions } from './http';

describe('getLoggerOptions', () => {
  it('disables logger in test', () => {
    expect(getLoggerOptions('test')).toBe(false);
  });

  it('uses default logger in production', () => {
    expect(getLoggerOptions('production')).toBe(true);
  });

  it('enables pretty logger with server name in development', () => {
    const opts = getLoggerOptions('development');
    expect(opts).toMatchObject({
      name: 'server',
      transport: {
        target: 'pino-pretty',
      },
    });
  });
});
