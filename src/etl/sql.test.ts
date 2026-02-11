import { describe, expect, it } from 'vitest';

import { firstCellAsNumber } from './sql.js';

describe('firstCellAsNumber', () => {
  it('returns number for numeric first cell', () => {
    expect(firstCellAsNumber([[42]], 'answer')).toBe(42);
  });

  it('coerces bigint and numeric strings', () => {
    expect(firstCellAsNumber([[42n]], 'big')).toBe(42);
    expect(firstCellAsNumber([[' 12.5 ']], 'string')).toBe(12.5);
  });

  it('throws on non-numeric values', () => {
    expect(() => firstCellAsNumber([[null]], 'null')).toThrow(
      /\[etl\] Expected numeric result for null/i,
    );
  });
});
