export function firstCellAsNumber(rows: unknown[][], label: string): number {
  const v = rows[0]?.[0];
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);

  throw new Error(`[etl] Expected numeric result for ${label}, got: ${String(v)}`);
}

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
