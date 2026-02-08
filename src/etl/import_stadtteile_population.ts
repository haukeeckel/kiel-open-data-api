import * as path from 'node:path';
import { env } from '../config/env';
import { durationMs, type EtlContext, nowMs } from './etlContext';
import { firstCellAsNumber } from './sql';
import { createEtlLogger } from '../logger/etl';
import { flushLogger } from '../logger/flush';
import { getDb } from '../infra/db/duckdb';

const log = createEtlLogger(env.NODE_ENV);

const CSV_PATH = path.join(process.cwd(), 'data', 'cache', 'kiel_bevoelkerung_stadtteile.csv');
const DATASET = 'stadtteile_population';
const ctx: EtlContext = { dataset: DATASET, step: 'import' };

const INDICATOR = 'population';
const AREA_TYPE = 'district';
const UNIT = 'persons';

async function main() {
  const started = nowMs();
  log.info(
    { ...ctx, csvPath: CSV_PATH, indicator: INDICATOR, areaType: AREA_TYPE },
    'etl.import: start',
  );

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

    await conn.run(`
      CREATE OR REPLACE TEMP TABLE raw AS
      SELECT *
      FROM read_csv_auto('${CSV_PATH}', header=true, delim=';');
    `);

    const info = await conn.runAndReadAll(`PRAGMA table_info('raw');`);
    const cols = info.getRows().map((r) => String(r[1]));
    const yearCols = cols.filter((c) => /^\d{4}$/.test(c));

    log.debug(
      { ...ctx, columns: cols.length, yearColumns: yearCols.length },
      'etl.import: detected columns',
    );

    if (yearCols.length === 0) {
      throw new Error('No year columns found (expected columns like 1988..2023).');
    }

    const inList = yearCols.map((c) => `"${c}"`).join(', ');

    // delete old rows for this slice
    const delRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM facts WHERE indicator = ? AND area_type = ?;`,
      [INDICATOR, AREA_TYPE],
    );
    const existing = firstCellAsNumber(delRes.getRows(), 'existing facts count');
    if (existing > 0) {
      log.info({ ...ctx, existing }, 'etl.import: deleting existing rows');
    }

    await conn.run(`DELETE FROM facts WHERE indicator = ? AND area_type = ?;`, [
      INDICATOR,
      AREA_TYPE,
    ]);

    await conn.run(`
      INSERT INTO facts
      SELECT
        '${INDICATOR}' AS indicator,
        '${AREA_TYPE}' AS area_type,
        "Stadtteil" AS area_name,
        CAST(year AS INTEGER) AS year,
        CAST(value AS DOUBLE) AS value,
        '${UNIT}' AS unit
      FROM (
        SELECT *
        FROM raw
        WHERE "Merkmal" = 'Einwohner insgesamt'
      )
      UNPIVOT(value FOR year IN (${inList}));
    `);

    await conn.run(`
      CREATE INDEX IF NOT EXISTS facts_idx
      ON facts(indicator, area_type, area_name, year);
    `);

    const countRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM facts WHERE indicator = ? AND area_type = ?;`,
      [INDICATOR, AREA_TYPE],
    );
    const imported = firstCellAsNumber(countRes.getRows(), 'imported facts count');

    log.info({ ...ctx, imported, ms: durationMs(started) }, 'etl.import: done');
  } catch (err) {
    log.error({ ...ctx, err, ms: durationMs(started) }, 'etl.import: failed');
    process.exitCode = 1;
  } finally {
    conn.disconnectSync();
    await flushLogger(log);
  }
}

void main();
