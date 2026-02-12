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
      ('gender','district','Vorstadt',2023,819,'persons', 'female'),
      ('age_groups','district','Altstadt',2022,1213,'persons', 'total'),
      ('age_groups','district','Altstadt',2023,1220,'persons', 'total'),
      ('age_groups','district','Vorstadt',2023,1648,'persons', 'total'),
      ('age_groups','district','Altstadt',2023,19,'persons', 'age_0_2'),
      ('age_groups','district','Altstadt',2023,14,'persons', 'age_3_5'),
      ('age_groups','district','Altstadt',2023,14,'persons', 'age_6_9'),
      ('age_groups','district','Altstadt',2023,8,'persons', 'age_10_11'),
      ('age_groups','district','Altstadt',2023,1,'persons', 'age_12_14'),
      ('age_groups','district','Altstadt',2023,10,'persons', 'age_15_17'),
      ('age_groups','district','Altstadt',2023,39,'persons', 'age_18_20'),
      ('age_groups','district','Altstadt',2023,143,'persons', 'age_21_24'),
      ('age_groups','district','Altstadt',2023,158,'persons', 'age_25_29'),
      ('age_groups','district','Altstadt',2023,141,'persons', 'age_30_34'),
      ('age_groups','district','Altstadt',2023,85,'persons', 'age_35_39'),
      ('age_groups','district','Altstadt',2023,74,'persons', 'age_40_44'),
      ('age_groups','district','Altstadt',2023,49,'persons', 'age_45_49'),
      ('age_groups','district','Altstadt',2023,54,'persons', 'age_50_54'),
      ('age_groups','district','Altstadt',2023,63,'persons', 'age_55_59'),
      ('age_groups','district','Altstadt',2023,55,'persons', 'age_60_64'),
      ('age_groups','district','Altstadt',2023,43,'persons', 'age_65_69'),
      ('age_groups','district','Altstadt',2023,48,'persons', 'age_70_74'),
      ('age_groups','district','Altstadt',2023,49,'persons', 'age_75_79'),
      ('age_groups','district','Altstadt',2023,153,'persons', 'age_80_plus'),
      ('age_groups','district','Vorstadt',2023,33,'persons', 'age_0_2'),
      ('age_groups','district','Vorstadt',2023,115,'persons', 'age_80_plus'),
      ('area_hectares','district','Altstadt',2019,35.0987,'hectares', 'total'),
      ('area_hectares','district','Altstadt',2020,35.0987,'hectares', 'total'),
      ('area_hectares','district','Vorstadt',2019,45.8515,'hectares', 'total'),
      ('area_hectares','district','Vorstadt',2020,45.8515,'hectares', 'total'),
      ('unemployed_count','district','Altstadt',2022,14,'persons', 'total'),
      ('unemployed_count','district','Altstadt',2023,16,'persons', 'total'),
      ('unemployed_count','district','Vorstadt',2022,43,'persons', 'total'),
      ('unemployed_count','district','Vorstadt',2023,43,'persons', 'total'),
      ('unemployed_rate','district','Altstadt',2018,2.3,'percent', 'total'),
      ('unemployed_rate','district','Altstadt',2019,1.6,'percent', 'total'),
      ('unemployed_rate','district','Vorstadt',2018,3.8,'percent', 'total'),
      ('unemployed_rate','district','Vorstadt',2019,4.2,'percent', 'total'),
      ('religion','district','Altstadt',2022,1200,'persons', 'total'),
      ('religion','district','Altstadt',2023,1220,'persons', 'total'),
      ('religion','district','Vorstadt',2022,1600,'persons', 'total'),
      ('religion','district','Vorstadt',2023,1648,'persons', 'total'),
      ('religion','district','Altstadt',2023,344,'persons', 'evangelical'),
      ('religion','district','Altstadt',2023,89,'persons', 'catholic'),
      ('religion','district','Altstadt',2023,787,'persons', 'other_or_none'),
      ('religion','district','Vorstadt',2023,414,'persons', 'evangelical'),
      ('religion','district','Vorstadt',2023,95,'persons', 'catholic'),
      ('religion','district','Vorstadt',2023,1139,'persons', 'other_or_none'),
      ('foreign_nationalities_selected','district','Altstadt',2022,64,'persons', 'total'),
      ('foreign_nationalities_selected','district','Altstadt',2023,71,'persons', 'total'),
      ('foreign_nationalities_selected','district','Vorstadt',2022,65,'persons', 'total'),
      ('foreign_nationalities_selected','district','Vorstadt',2023,75,'persons', 'total'),
      ('foreign_nationalities_selected','district','Altstadt',2023,8,'persons', 'turkey'),
      ('foreign_nationalities_selected','district','Altstadt',2023,4,'persons', 'poland'),
      ('foreign_nationalities_selected','district','Altstadt',2023,9,'persons', 'iraq'),
      ('foreign_nationalities_selected','district','Altstadt',2023,16,'persons', 'russia'),
      ('foreign_nationalities_selected','district','Altstadt',2023,21,'persons', 'ukraine'),
      ('foreign_nationalities_selected','district','Altstadt',2023,7,'persons', 'syria'),
      ('foreign_nationalities_selected','district','Altstadt',2023,6,'persons', 'bulgaria'),
      ('foreign_nationalities_selected','district','Vorstadt',2023,11,'persons', 'turkey'),
      ('foreign_nationalities_selected','district','Vorstadt',2023,16,'persons', 'ukraine'),
      ('foreign_nationalities_selected','district','Vorstadt',2023,1,'persons', 'bulgaria'),
      ('foreign_age_groups','district','Altstadt',2022,212,'persons', 'total'),
      ('foreign_age_groups','district','Altstadt',2023,212,'persons', 'total'),
      ('foreign_age_groups','district','Vorstadt',2022,324,'persons', 'total'),
      ('foreign_age_groups','district','Vorstadt',2023,324,'persons', 'total'),
      ('foreign_age_groups','district','Altstadt',2023,4,'persons', 'age_0_2'),
      ('foreign_age_groups','district','Altstadt',2023,2,'persons', 'age_3_5'),
      ('foreign_age_groups','district','Altstadt',2023,4,'persons', 'age_6_9'),
      ('foreign_age_groups','district','Altstadt',2023,3,'persons', 'age_10_11'),
      ('foreign_age_groups','district','Altstadt',2023,0,'persons', 'age_12_14'),
      ('foreign_age_groups','district','Altstadt',2023,5,'persons', 'age_15_17'),
      ('foreign_age_groups','district','Altstadt',2023,6,'persons', 'age_18_20'),
      ('foreign_age_groups','district','Altstadt',2023,27,'persons', 'age_21_24'),
      ('foreign_age_groups','district','Altstadt',2023,32,'persons', 'age_25_29'),
      ('foreign_age_groups','district','Altstadt',2023,30,'persons', 'age_30_34'),
      ('foreign_age_groups','district','Altstadt',2023,23,'persons', 'age_35_39'),
      ('foreign_age_groups','district','Altstadt',2023,17,'persons', 'age_40_44'),
      ('foreign_age_groups','district','Altstadt',2023,15,'persons', 'age_45_49'),
      ('foreign_age_groups','district','Altstadt',2023,13,'persons', 'age_50_54'),
      ('foreign_age_groups','district','Altstadt',2023,10,'persons', 'age_55_59'),
      ('foreign_age_groups','district','Altstadt',2023,5,'persons', 'age_60_64'),
      ('foreign_age_groups','district','Altstadt',2023,7,'persons', 'age_65_69'),
      ('foreign_age_groups','district','Altstadt',2023,4,'persons', 'age_70_74'),
      ('foreign_age_groups','district','Altstadt',2023,2,'persons', 'age_75_79'),
      ('foreign_age_groups','district','Altstadt',2023,3,'persons', 'age_80_plus'),
      ('foreign_age_groups','district','Vorstadt',2023,10,'persons', 'age_0_2'),
      ('foreign_age_groups','district','Vorstadt',2023,7,'persons', 'age_80_plus');
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
