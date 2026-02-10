import type { DuckDBConnection } from '@duckdb/node-api';
import * as crypto from 'node:crypto';

type Migration = {
  version: number;
  name: string;
  up: string;
};

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_statistics_table',
    up: `
      CREATE TABLE IF NOT EXISTS statistics (
        indicator TEXT,
        area_type TEXT,
        area_name TEXT,
        year INTEGER,
        value DOUBLE,
        unit TEXT
      );
    `,
  },
];

function hashMigration(migration: Migration): string {
  const payload = JSON.stringify({
    version: migration.version,
    name: migration.name,
    up: migration.up,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function applyMigrations(conn: DuckDBConnection): Promise<void> {
  await conn.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      hash TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const res = await conn.runAndReadAll(`SELECT version, hash FROM schema_migrations;`);
  const applied = new Map<number, string>(
    res.getRowObjects().map((r) => [Number(r['version']), String(r['hash'])]),
  );

  const ordered = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of ordered) {
    const hash = hashMigration(migration);
    const existingHash = applied.get(migration.version);
    if (existingHash) {
      if (existingHash !== hash) {
        throw new Error(
          `Migration ${migration.version} (${migration.name}) checksum mismatch. ` +
            `Expected ${existingHash}, got ${hash}.`,
        );
      }
      continue;
    }

    await conn.run('BEGIN TRANSACTION');
    try {
      await conn.run(migration.up);
      await conn.run(`INSERT INTO schema_migrations (version, name, hash) VALUES (?, ?, ?);`, [
        migration.version,
        migration.name,
        hash,
      ]);
      await conn.run('COMMIT');
    } catch (err) {
      await conn.run('ROLLBACK');
      throw err;
    }
  }
}
