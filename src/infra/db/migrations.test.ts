import { DuckDBInstance } from '@duckdb/node-api';
import { describe, expect, it } from 'vitest';

import {
  applyMigrations,
  assertMigrationsUpToDate,
  getLatestMigrationVersion,
} from './migrations.js';

describe('applyMigrations', () => {
  it('rejects NULL for every column in statistics', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();

    try {
      await applyMigrations(conn);

      const valid = ['population', 'district', 'Altstadt', 2023, 1200, 'persons', 'total'] as const;

      for (let i = 0; i < valid.length; i++) {
        const row = [...valid];
        row[i] = null as never;
        const placeholders = row.map(() => '?').join(',');

        await expect(
          conn.runAndReadAll(`INSERT INTO statistics VALUES (${placeholders});`, [...row]),
        ).rejects.toThrow(/(constraint|not null)/i);
      }
    } finally {
      conn.closeSync();
    }
  });

  it('rejects duplicate rows for indicator/area_type/area_name/year', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();

    try {
      await applyMigrations(conn);

      const row = ['population', 'district', 'Altstadt', 2023, 1200, 'persons', 'total'] as const;
      await conn.runAndReadAll(`INSERT INTO statistics VALUES (?,?,?,?,?,?,?);`, [...row]);

      await expect(
        conn.runAndReadAll(`INSERT INTO statistics VALUES (?,?,?,?,?,?,?);`, [...row]),
      ).rejects.toThrow(/(unique|constraint)/i);
    } finally {
      conn.closeSync();
    }
  });

  it('allows same dimensions with different category but rejects exact duplicates', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();

    try {
      await applyMigrations(conn);

      const base = ['population', 'district', 'Altstadt', 2023, 1200, 'persons'] as const;
      await conn.runAndReadAll(`INSERT INTO statistics VALUES (?,?,?,?,?,?,?);`, [
        ...base,
        'total',
      ]);
      await conn.runAndReadAll(`INSERT INTO statistics VALUES (?,?,?,?,?,?,?);`, [...base, 'male']);

      await expect(
        conn.runAndReadAll(`INSERT INTO statistics VALUES (?,?,?,?,?,?,?);`, [...base, 'male']),
      ).rejects.toThrow(/(unique|constraint)/i);
    } finally {
      conn.closeSync();
    }
  });

  it('applies all migrations and is idempotent', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();

    try {
      await applyMigrations(conn);

      const reader = await conn.runAndReadAll(
        'SELECT version FROM schema_migrations ORDER BY version;',
      );
      const versions = reader.getRowObjects().map((r) => Number(r['version']));
      expect(versions.length).toBeGreaterThan(0);
      expect(versions).toEqual([...versions].sort((a, b) => a - b));

      const tableReader = await conn.runAndReadAll(
        "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_name = 'statistics';",
      );
      expect(Number(tableReader.getRowObjects()[0]?.['c'])).toBe(1);

      // re-running does not add or change entries
      await applyMigrations(conn);
      const after = await conn.runAndReadAll(
        'SELECT version FROM schema_migrations ORDER BY version;',
      );
      const versionsAfter = after.getRowObjects().map((r) => Number(r['version']));
      expect(versionsAfter).toEqual(versions);
    } finally {
      conn.closeSync();
    }
  });

  it('throws on hash mismatch', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();

    try {
      // set up schema_migrations with a tampered hash for version 1
      await conn.run(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await conn.run(
        `INSERT INTO schema_migrations (version, name, hash) VALUES (1, 'create_statistics_table', 'bad_hash');`,
      );

      await expect(applyMigrations(conn)).rejects.toThrow(/checksum mismatch/i);
    } finally {
      conn.closeSync();
    }
  });
});

describe('assertMigrationsUpToDate', () => {
  it('passes when schema is up to date', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();

    try {
      await applyMigrations(conn);
      await expect(assertMigrationsUpToDate(conn)).resolves.toBeUndefined();
    } finally {
      conn.closeSync();
    }
  });

  it('fails when schema_migrations table is missing', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();

    try {
      await expect(assertMigrationsUpToDate(conn)).rejects.toThrow(/missing schema_migrations/i);
    } finally {
      conn.closeSync();
    }
  });

  it('fails when latest migration version is not applied', async () => {
    const db = await DuckDBInstance.create(':memory:');
    const conn = await db.connect();

    try {
      await conn.run(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          hash TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await conn.run(
        `INSERT INTO schema_migrations (version, name, hash) VALUES (1, 'create_statistics_table', 'hash');`,
      );

      const latest = getLatestMigrationVersion();
      await expect(assertMigrationsUpToDate(conn)).rejects.toThrow(
        new RegExp(`current=1, latest=${latest}`),
      );
    } finally {
      conn.closeSync();
    }
  });
});
