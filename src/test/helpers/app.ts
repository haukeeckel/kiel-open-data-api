import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { DuckDBInstance } from '@duckdb/node-api';

import { buildServer } from '../../app/server.js';
import { getCacheDir } from '../../config/path.js';
import { applyMigrations } from '../../infra/db/migrations.js';

import { setTestEnv } from './env.js';

export function makeTestDbPath() {
  const id = crypto.randomUUID();
  return path.join(getCacheDir(), `test-${id}.duckdb`);
}

export async function seedStatistics(db: DuckDBInstance) {
  const conn = await db.connect();

  try {
    await applyMigrations(conn);

    await conn.run(`DELETE FROM statistics;`);

    await conn.run(
      `
      INSERT INTO statistics (indicator, area_type, area_name, year, value, unit) VALUES
      ('population','district','Altstadt',2022,1213,'persons'),
      ('population','district','Altstadt',2023,1220,'persons'),
      ('population','district','Gaarden-Ost',2023,18000,'persons'),
      ('population','district','Schreventeich',2023,9000,'persons');
      `,
    );
  } finally {
    conn.closeSync();
  }
}

export async function makeAppAndSeed() {
  const dbPath = makeTestDbPath();

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  setTestEnv({ NODE_ENV: 'test', DUCKDB_PATH: dbPath });

  // Seed first, then close so the app can open its own instance
  const db = await DuckDBInstance.create(dbPath);
  await seedStatistics(db);

  const app = await buildServer();

  app.get('/__boom', async () => {
    throw new Error('boom');
  });

  app.get('/__401', async () => {
    const err = new Error('nope');
    (err as unknown as { statusCode: number }).statusCode = 401;
    throw err;
  });

  app.get('/__409', async () => {
    const err = new Error('conflict');
    (err as unknown as { statusCode: number }).statusCode = 409;
    throw err;
  });

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
