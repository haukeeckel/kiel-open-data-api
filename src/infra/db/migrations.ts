import * as crypto from 'node:crypto';

import type { DuckDBConnection } from '@duckdb/node-api';

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
  {
    version: 2,
    name: 'create_statistics_index',
    up: `
      CREATE INDEX IF NOT EXISTS statistics_idx
      ON statistics(indicator, area_type, area_name, year);
    `,
  },
  {
    version: 3,
    name: 'statistics_columns_not_null',
    up: `
      DELETE FROM statistics
      WHERE indicator IS NULL
         OR area_type IS NULL
         OR area_name IS NULL
         OR year IS NULL
         OR value IS NULL
         OR unit IS NULL;
      DROP INDEX IF EXISTS statistics_idx;
      ALTER TABLE statistics ALTER COLUMN indicator SET NOT NULL;
      ALTER TABLE statistics ALTER COLUMN area_type SET NOT NULL;
      ALTER TABLE statistics ALTER COLUMN area_name SET NOT NULL;
      ALTER TABLE statistics ALTER COLUMN year SET NOT NULL;
      ALTER TABLE statistics ALTER COLUMN value SET NOT NULL;
      ALTER TABLE statistics ALTER COLUMN unit SET NOT NULL;
      CREATE INDEX statistics_idx
      ON statistics(indicator, area_type, area_name, year);
    `,
  },
  {
    version: 4,
    name: 'statistics_unique_constraint',
    up: `
      DROP INDEX IF EXISTS statistics_idx;
      CREATE UNIQUE INDEX IF NOT EXISTS statistics_unique_idx
      ON statistics(indicator, area_type, area_name, year);
    `,
  },
  {
    version: 5,
    name: 'add_category_column',
    up: `
      DROP INDEX IF EXISTS statistics_unique_idx;
      ALTER TABLE statistics ADD COLUMN category TEXT DEFAULT 'total';
      UPDATE statistics SET category = 'total' WHERE category IS NULL;
      ALTER TABLE statistics ALTER COLUMN category SET NOT NULL;
      CREATE UNIQUE INDEX statistics_unique_cat_idx
      ON statistics(indicator, area_type, area_name, year, category);
    `,
  },
];

export function getLatestMigrationVersion(): number {
  const latest = migrations.reduce((max, migration) => Math.max(max, migration.version), 0);
  return latest;
}

export async function assertMigrationsUpToDate(conn: DuckDBConnection): Promise<void> {
  const latestVersion = getLatestMigrationVersion();

  const tableReader = await conn.runAndReadAll(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.tables
    WHERE table_name = 'schema_migrations';
    `,
  );
  const hasSchemaMigrations = Number(tableReader.getRowObjects()[0]?.['c']) > 0;
  if (!hasSchemaMigrations) {
    throw new Error(
      `Database schema is not initialized (missing schema_migrations table). ` +
        `Run "pnpm migrate" before starting the app.`,
    );
  }

  const versionReader = await conn.runAndReadAll(
    `SELECT COALESCE(MAX(version), 0) AS max_version FROM schema_migrations;`,
  );
  const currentVersion = Number(versionReader.getRowObjects()[0]?.['max_version'] ?? 0);

  if (currentVersion !== latestVersion) {
    throw new Error(
      `Database schema is out of date (current=${currentVersion}, latest=${latestVersion}). ` +
        `Run "pnpm migrate" before starting the app.`,
    );
  }
}

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
