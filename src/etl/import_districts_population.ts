import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { getEnv } from '../config/env.js';
import { getDuckDbPath, getCacheDir } from '../config/path.js';
import { createDb } from '../infra/db/duckdb.js';
import { applyMigrations } from '../infra/db/migrations.js';
import { createEtlLogger } from '../logger/etl.js';

import {
  AREA_TYPE,
  CSV_COL_AREA,
  CSV_COL_INDICATOR,
  CSV_FILENAME,
  CSV_FILTER_VALUE,
  DATASET,
  INDICATOR,
  UNIT,
} from './districts_population.constants.js';
import { durationMs, type EtlContext, nowMs } from './etlContext.js';
import { firstCellAsNumber } from './sql.js';

const log = createEtlLogger(getEnv().NODE_ENV);
const ctx: EtlContext = { dataset: DATASET, step: 'import' };

export async function importDistrictsPopulation(opts?: {
  csvPath?: string;
  dbPath?: string;
}): Promise<{
  imported: number;
  csvPath: string;
  dbPath: string;
}> {
  const started = nowMs();

  const env = getEnv();
  const csvPath = opts?.csvPath ?? path.join(getCacheDir(), CSV_FILENAME);
  const dbPath = opts?.dbPath ?? getDuckDbPath(env);

  log.info({ ...ctx, csvPath, indicator: INDICATOR, areaType: AREA_TYPE }, 'etl.import: start');

  try {
    await fs.access(csvPath);
  } catch {
    throw new Error(`CSV file not found: ${csvPath}. Run fetch step first.`);
  }

  const dbLogger = log.child({ name: 'db' });
  const db = await createDb(dbPath, { logger: dbLogger });
  const conn = await db.connect();

  try {
    await applyMigrations(conn);

    const safeCsvPath = csvPath.replaceAll("'", "''");
    await conn.run(`
      CREATE OR REPLACE TEMP TABLE raw AS
      SELECT *
      FROM read_csv_auto('${safeCsvPath}', header=true, delim=';');
    `);

    const info = await conn.runAndReadAll(`PRAGMA table_info('raw');`);
    const cols = info.getRowObjects().map((r) => String(r['name']));
    const yearCols = cols.filter((c) => /^\d{4}$/.test(c));

    log.debug(
      { ...ctx, columns: cols.length, yearColumns: yearCols.length },
      'etl.import: detected columns',
    );

    const requiredCols = [CSV_COL_INDICATOR, CSV_COL_AREA];
    const missing = requiredCols.filter((c) => !cols.includes(c));
    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(', ')}`);
    }

    if (yearCols.length === 0) {
      throw new Error('No year columns found (expected columns like 1988..2023).');
    }

    const inList = yearCols.map((c) => `"${c}"`).join(', ');

    // delete + insert in a transaction to avoid empty table on crash (#4)
    await conn.run('BEGIN TRANSACTION');
    try {
      const delRes = await conn.runAndReadAll(
        `SELECT COUNT(*) FROM statistics WHERE indicator = ? AND area_type = ?;`,
        [INDICATOR, AREA_TYPE],
      );
      const existing = firstCellAsNumber(delRes.getRows(), 'existing statistics count');
      if (existing > 0) {
        log.info({ ...ctx, existing }, 'etl.import: deleting existing rows');
      }

      await conn.run(`DELETE FROM statistics WHERE indicator = ? AND area_type = ?;`, [
        INDICATOR,
        AREA_TYPE,
      ]);

      await conn.run(
        `
        INSERT INTO statistics
        SELECT
          ? AS indicator,
          ? AS area_type,
          "${CSV_COL_AREA}" AS area_name,
          CAST(year AS INTEGER) AS year,
          CAST(value AS DOUBLE) AS value,
          ? AS unit
        FROM (
          SELECT *
          FROM raw
          WHERE "${CSV_COL_INDICATOR}" = '${CSV_FILTER_VALUE}'
        )
        UNPIVOT(value FOR year IN (${inList}));
        `,
        [INDICATOR, AREA_TYPE, UNIT],
      );

      await conn.run('COMMIT');
    } catch (err) {
      await conn.run('ROLLBACK');
      throw err;
    }

    const countRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM statistics WHERE indicator = ? AND area_type = ?;`,
      [INDICATOR, AREA_TYPE],
    );
    const imported = firstCellAsNumber(countRes.getRows(), 'imported statistics count');

    log.info({ ...ctx, imported, ms: durationMs(started) }, 'etl.import: done');

    return { imported, csvPath, dbPath };
  } finally {
    conn.closeSync();
  }
}
