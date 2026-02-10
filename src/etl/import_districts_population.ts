import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getEnv } from '../config/env';
import { durationMs, type EtlContext, nowMs } from './etlContext';
import { firstCellAsNumber } from './sql';
import { createEtlLogger } from '../logger/etl';
import { createDb } from '../infra/db/duckdb';
import { STATISTICS_DDL } from '../infra/db/schema';
import { getDuckDbPath, getCacheDir } from '../config/path';
import {
  AREA_TYPE,
  CSV_FILENAME,
  DATASET,
  INDICATOR,
  UNIT,
} from './districts_population.constants';

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

  const db = await createDb(dbPath);
  const conn = await db.connect();

  try {
    await conn.run(STATISTICS_DDL);

    const safeCsvPath = csvPath.replaceAll("'", "''");
    await conn.run(`
      CREATE OR REPLACE TEMP TABLE raw AS
      SELECT *
      FROM read_csv_auto('${safeCsvPath}', header=true, delim=';');
    `);

    const info = await conn.runAndReadAll(`PRAGMA table_info('raw');`);
    const cols = info.getRowObjects().map((r) => String(r.name));
    const yearCols = cols.filter((c) => /^\d{4}$/.test(c));

    log.debug(
      { ...ctx, columns: cols.length, yearColumns: yearCols.length },
      'etl.import: detected columns',
    );

    const requiredCols = ['Merkmal', 'Stadtteil'];
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
          "Stadtteil" AS area_name,
          CAST(year AS INTEGER) AS year,
          CAST(value AS DOUBLE) AS value,
          ? AS unit
        FROM (
          SELECT *
          FROM raw
          WHERE "Merkmal" = 'Einwohner insgesamt'
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

    await conn.run(`
      CREATE INDEX IF NOT EXISTS statistics_idx
      ON statistics(indicator, area_type, area_name, year);
    `);

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
