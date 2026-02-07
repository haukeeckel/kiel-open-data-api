import * as path from 'node:path';
import { getDb } from '../db';

const CSV_PATH = path.join(process.cwd(), 'data', 'cache', 'kiel_bevoelkerung_stadtteile.csv');

const INDICATOR = 'population';
const AREA_TYPE = 'district';
const UNIT = 'persons';

async function main() {
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

    // Raw lesen (delim=';' weil Kiel CSV so aussieht)
    await conn.run(`
      CREATE OR REPLACE TEMP TABLE raw AS
      SELECT *
      FROM read_csv_auto('${CSV_PATH}', header=true, delim=';');
    `);

    // Jahres-Spalten + Spaltenliste
    const info = await conn.runAndReadAll(`PRAGMA table_info('raw');`);
    const cols = info.getRows().map((r) => String(r[1]));

    const yearCols = cols.filter((c) => /^\d{4}$/.test(c));
    if (yearCols.length === 0) {
      throw new Error('[etl] No year columns found (expected columns like 1988..2023).');
    }

    // UNPIVOT braucht explizite Spaltenliste
    const inList = yearCols.map((c) => `"${c}"`).join(', ');

    // idempotent: alte Werte für diesen Indicator/AreaType entfernen
    await conn.run(`DELETE FROM facts WHERE indicator = ? AND area_type = ?;`, [
      INDICATOR,
      AREA_TYPE,
    ]);

    // Import wide -> long
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
  } catch (err) {
    console.error('[etl] import failed:', err);
    throw err;
  } finally {
    conn.disconnectSync();
  }
}

void main();
