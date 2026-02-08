import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { buildServer } from '../../app/server';
import { getDb, resetDbForTests } from '../../db';

export function makeTestDbPath() {
  const id = crypto.randomUUID();
  return path.join(process.cwd(), 'data', 'cache', `test-${id}.duckdb`);
}

export async function seedFacts() {
  const db = await getDb();
  const conn = await db.connect();

  try {
    await conn.run(`
      CREATE TABLE IF NOT EXISTS facts (
        indicator TEXT,
        area_type TEXT,
        area_name TEXT,
        year INTEGER,
        value DOUBLE,
        unit TEXT
      );
    `);

    await conn.run(`DELETE FROM facts;`);

    await conn.run(
      `
      INSERT INTO facts (indicator, area_type, area_name, year, value, unit) VALUES
      ('population','district','Altstadt',2022,1213,'persons'),
      ('population','district','Altstadt',2023,1220,'persons'),
      ('population','district','Gaarden-Ost',2023,18000,'persons'),
      ('population','district','Schreventeich',2023,9000,'persons');
      `,
    );
  } finally {
    conn.disconnectSync();
  }
}

export async function makeAppAndSeed() {
  const dbPath = makeTestDbPath();

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  process.env.NODE_ENV = 'test';
  process.env.DUCKDB_PATH = dbPath;
  resetDbForTests();

  const app = await buildServer();

  app.get('/__boom', async () => {
    throw new Error('boom');
  });

  await seedFacts();
  await app.ready();

  return { app, dbPath };
}

export function cleanupDuckDbFiles(dbPath: string) {
  const candidates = [dbPath, `${dbPath}.wal`, `${dbPath}.shm`];

  for (const file of candidates) {
    try {
      fs.unlinkSync(file);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? (err as { code?: unknown }).code
          : undefined;
      if (code === 'ENOENT') continue;
      throw err;
    }
  }
}
