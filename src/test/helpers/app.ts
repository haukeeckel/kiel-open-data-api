import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { buildServer } from '../../app/server';
import { getDb, resetDbForTests } from '../../infra/db/duckdb';
import { resetEnvForTests } from '../../config/env';

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

  // 1) env setzen (weil getDuckDbPath() in seedFacts() die env vars braucht, um den db path zu bestimmen)
  process.env.NODE_ENV = 'test';
  process.env.DUCKDB_PATH = dbPath;

  // 2) caches zurücksetzen (weil getEnv() und getDb() gecachedten Wert zurückgeben würden, obwohl wir die env vars gerade geändert haben)
  resetEnvForTests();
  resetDbForTests();

  // 3) server bauen (weil z.B. die Repositories den Db-Client brauchen, um die seed-Funktion auszuführen; außerdem wollen wir sicherstellen, dass der Server mit der Test-DB funktioniert)
  const app = await buildServer();

  app.get('/__boom', async () => {
    throw new Error('boom');
  });

  // 4) seed ausführen (weil die Tests Daten in der DB brauchen)
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

export function cleanupTestEnv() {
  delete process.env.DUCKDB_PATH;
  delete process.env.NODE_ENV;
  resetEnvForTests();
  resetDbForTests();
}
