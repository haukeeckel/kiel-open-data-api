import { quoteIdentifier } from '../sql.js';

import type { DuckDBConnection } from '@duckdb/node-api';

export async function normalizeRawHeaders(
  conn: DuckDBConnection,
  columnAliases?: Record<string, readonly string[]>,
): Promise<string[]> {
  const info = await conn.runAndReadAll(`PRAGMA table_info('raw');`);
  const columns = info.getRowObjects().map((row) => String(row['name']));
  const normalized = columns.map((name) => name.trim());

  if (columnAliases) {
    for (const [targetColumn, aliases] of Object.entries(columnAliases)) {
      const target = targetColumn.trim();
      if (normalized.includes(target)) continue;

      const aliasSet = new Set(aliases.map((alias) => alias.trim()));
      const matches = normalized
        .map((name, idx) => (aliasSet.has(name) ? idx : -1))
        .filter((idx) => idx >= 0);

      if (matches.length > 1) {
        throw new Error(
          `Header alias collision: ${target} matches multiple aliases [${matches
            .map((idx) => columns[idx])
            .join(', ')}]`,
        );
      }
      if (matches.length === 1) {
        const matchIdx = matches[0];
        if (matchIdx !== undefined) {
          normalized[matchIdx] = target;
        }
      }
    }
  }

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
