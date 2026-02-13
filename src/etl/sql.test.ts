import { describe, expect, it } from 'vitest';

import { firstCellAsNumber, quoteIdentifier, quoteLiteral } from './sql.js';

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

describe('quoteIdentifier', () => {
  it('wraps with double-quotes and escapes embedded quotes', () => {
    expect(quoteIdentifier('raw')).toBe('"raw"');
    expect(quoteIdentifier('a"b')).toBe('"a""b"');
  });
});

describe('quoteLiteral', () => {
  it('wraps with single-quotes and escapes embedded quotes', () => {
    expect(quoteLiteral('raw')).toBe("'raw'");
    expect(quoteLiteral("a'b")).toBe("'a''b'");
  });
});
