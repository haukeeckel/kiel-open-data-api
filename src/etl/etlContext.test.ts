import { describe, expect, it, vi } from 'vitest';

import { durationMs, nowMs } from './etlContext.js';

describe('etlContext time helpers', () => {
  it('nowMs returns Date.now', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(123);
    try {
      expect(nowMs()).toBe(123);
    } finally {
      spy.mockRestore();
    }
  });

  it('durationMs returns delta from start', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(500);
    try {
      expect(durationMs(200)).toBe(300);
    } finally {
      spy.mockRestore();
    }
  });
});
