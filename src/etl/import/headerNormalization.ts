import { quoteIdentifier } from '../sql.js';

import type { DuckDBConnection } from '@duckdb/node-api';

export async function normalizeRawHeaders(conn: DuckDBConnection): Promise<string[]> {
  const info = await conn.runAndReadAll(`PRAGMA table_info('raw');`);
  const columns = info.getRowObjects().map((row) => String(row['name']));
  const normalized = columns.map((name) => name.trim());

  const changed = columns.some((name, idx) => name !== normalized[idx]);
  if (!changed) return columns;

  const duplicates = new Map<string, string[]>();
  for (let i = 0; i < columns.length; i += 1) {
    const key = normalized[i] ?? '';
    const existing = duplicates.get(key) ?? [];
    existing.push(columns[i] ?? '');
    duplicates.set(key, existing);
  }
  const collisions = [...duplicates.entries()]
    .filter(([, originals]) => originals.length > 1)
    .map(([trimmed, originals]) => `${trimmed} <- [${originals.join(', ')}]`);
  if (collisions.length > 0) {
    throw new Error(`Header normalization collision: ${collisions.join('; ')}`);
  }

  const projection = columns
    .map((name, idx) => `${quoteIdentifier(name)} AS ${quoteIdentifier(normalized[idx] ?? '')}`)
    .join(', ');
  await conn.run(`
    CREATE OR REPLACE TEMP TABLE raw AS
    SELECT ${projection}
    FROM raw;
  `);
  return normalized;
}
