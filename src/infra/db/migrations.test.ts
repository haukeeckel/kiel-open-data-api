import { DuckDBInstance } from '@duckdb/node-api';
import { describe, expect, it } from 'vitest';

import { applyMigrations } from './migrations.js';

describe('applyMigrations', () => {
  it('creates schema_migrations and applies all migrations', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();

    try {
      await applyMigrations(conn);

      const countReader = await conn.runAndReadAll('SELECT COUNT(*) AS c FROM schema_migrations;');
      expect(Number(countReader.getRowObjects()[0]?.['c'])).toBe(2);

      const tableReader = await conn.runAndReadAll(
        "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_name = 'statistics';",
      );
      expect(Number(tableReader.getRowObjects()[0]?.['c'])).toBe(1);

      await applyMigrations(conn);
      const secondCount = await conn.runAndReadAll('SELECT COUNT(*) AS c FROM schema_migrations;');
      expect(Number(secondCount.getRowObjects()[0]?.['c'])).toBe(2);
    } finally {
      conn.closeSync();
    }
  });
});
