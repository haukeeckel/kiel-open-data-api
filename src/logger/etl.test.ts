import { describe, expect, it } from 'vitest';
import { createEtlLogger } from './etl.js';

describe('createEtlLogger', () => {
  it('uses info level in production', () => {
    const logger = createEtlLogger('production');
    expect(logger.level).toBe('info');
    expect(logger.bindings()['name']).toBe('etl');
  });

  it('uses debug level in development', () => {
    const logger = createEtlLogger('development');
    expect(logger.level).toBe('debug');
    expect(logger.bindings()['name']).toBe('etl');
  });
});
