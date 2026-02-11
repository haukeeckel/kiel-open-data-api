import { describe, expect, it, vi } from 'vitest';

import { flushLogger } from './flush.js';

import type { Logger } from 'pino';

describe('flushLogger', () => {
  it('resolves when logger has no flush', async () => {
    const log = {} as Logger;
    await expect(flushLogger(log)).resolves.toBeUndefined();
  });

  it('resolves when flush succeeds', async () => {
    const log = {
      flush: vi.fn((cb: (err?: Error) => void) => cb()),
    } as unknown as Logger;

    await expect(flushLogger(log)).resolves.toBeUndefined();
    expect(log.flush).toHaveBeenCalled();
  });

  it('rejects when flush returns error', async () => {
    const log = {
      flush: vi.fn((cb: (err?: Error) => void) => cb(new Error('boom'))),
    } as unknown as Logger;

    await expect(flushLogger(log)).rejects.toThrow(/boom/i);
  });
});
