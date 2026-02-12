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
      INSERT INTO statistics (indicator, area_type, area_name, year, value, unit, category) VALUES
      ('population','district','Altstadt',2022,1213,'persons', 'total'),
      ('population','district','Altstadt',2023,1220,'persons', 'total'),
      ('population','district','Gaarden-Ost',2023,18000,'persons', 'total'),
      ('population','district','Schreventeich',2023,9000,'persons', 'total'),
      ('households','district','Altstadt',2023,810,'households', 'total'),
      ('households','district','Altstadt',2023,505,'households', 'single_person'),
      ('households','district','Gaarden-Ost',2023,6050,'households', 'total'),
      ('households','district','Gaarden-Ost',2023,3220,'households', 'single_person'),
      ('marital_status','district','Altstadt',2022,1183,'persons', 'total'),
      ('marital_status','district','Altstadt',2023,1220,'persons', 'total'),
      ('marital_status','district','Vorstadt',2023,1648,'persons', 'total'),
      ('marital_status','district','Altstadt',2023,702,'persons', 'single'),
      ('marital_status','district','Altstadt',2023,339,'persons', 'married'),
      ('marital_status','district','Altstadt',2023,94,'persons', 'widowed'),
      ('marital_status','district','Altstadt',2023,85,'persons', 'divorced'),
      ('marital_status','district','Vorstadt',2023,1038,'persons', 'single'),
      ('gender','district','Altstadt',2022,1213,'persons', 'total'),
      ('gender','district','Altstadt',2023,1220,'persons', 'total'),
      ('gender','district','Vorstadt',2023,1648,'persons', 'total'),
      ('gender','district','Altstadt',2023,638,'persons', 'male'),
      ('gender','district','Altstadt',2023,582,'persons', 'female'),
      ('gender','district','Vorstadt',2023,829,'persons', 'male'),
      ('gender','district','Vorstadt',2023,819,'persons', 'female');
      `,
    );
  } finally {
    conn.closeSync();
  }
}

type MakeAppOptions = {
  registerRoutes?: (app: Awaited<ReturnType<typeof buildServer>>) => void | Promise<void>;
};

export async function makeAppAndSeed(options: MakeAppOptions = {}) {
  const dbPath = makeTestDbPath();

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  setTestEnv({ NODE_ENV: 'test', DUCKDB_PATH: dbPath });

  // Seed first, then close so the app can open its own instance
  const db = await DuckDBInstance.create(dbPath);
  await seedStatistics(db);

  const app = await buildServer();
  if (options.registerRoutes) {
    await options.registerRoutes(app);
  }

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
