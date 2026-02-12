import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { getEnv } from '../config/env.js';
import { getDuckDbPath, getCacheDir } from '../config/path.js';
import { createDb } from '../infra/db/duckdb.js';
import { applyMigrations } from '../infra/db/migrations.js';

import { durationMs, nowMs } from './etlContext.js';
import { getEtlLogger } from './etlLogger.js';
import { firstCellAsNumber } from './sql.js';

import type { DatasetConfig } from './datasets/types.js';
import type { DuckDBConnection } from '@duckdb/node-api';

export type ImportDatasetOptions = {
  csvPath?: string | undefined;
  dbPath?: string | undefined;
};

export type ImportDatasetResult = {
  imported: number;
  csvPath: string;
  dbPath: string;
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function getYearColumns(columns: readonly string[], config: DatasetConfig): string[] {
  const format = config.format;
  const yearPattern = format.yearPattern ?? /^\d{4}$/;
  return columns.filter((col) => yearPattern.test(col));
}

function yearExpr(config: DatasetConfig, yearCols: readonly string[]): string {
  const parseYear = config.format.yearParser;
  if (!parseYear) return 'year';

  const cases = yearCols
    .map((col) => `WHEN ${quoteLiteral(col)} THEN ${String(parseYear(col))}`)
    .join(' ');
  return `CASE year ${cases} ELSE NULL END`;
}

async function importUnpivotYears(args: {
  conn: DuckDBConnection;
  config: DatasetConfig;
  cols: readonly string[];
  yearCols: readonly string[];
  log: ReturnType<typeof getEtlLogger>['log'];
  ctx: ReturnType<typeof getEtlLogger>['ctx'];
}): Promise<number> {
  const { conn, config, cols, yearCols, log, ctx } = args;
  const format = config.format;

  if (format.type !== 'unpivot_years') {
    throw new Error(`Unsupported CSV format: ${format.type}`);
  }

  const requiredCols = [format.indicatorColumn];
  if (config.areaColumn) requiredCols.push(config.areaColumn);
  const missing = requiredCols.filter((col) => !cols.includes(col));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  if (yearCols.length === 0) {
    throw new Error('No year columns found (expected columns like 1988..2023).');
  }

  const inList = yearCols.map((col) => quoteIdentifier(col)).join(', ');
  const indicatorColumn = quoteIdentifier(format.indicatorColumn);
  const sqlYearExpr = yearExpr(config, yearCols);

  await conn.run('BEGIN TRANSACTION');
  try {
    for (const row of format.rows) {
      const delRes = await conn.runAndReadAll(
        `SELECT COUNT(*) FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
        [row.indicator, config.areaType, row.category],
      );
      const existing = firstCellAsNumber(delRes.getRows(), 'existing statistics count');
      if (existing > 0) {
        log.info(
          { ...ctx, indicator: row.indicator, category: row.category, existing },
          'etl.import: deleting existing rows',
        );
      }

      await conn.run(
        `DELETE FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
        [row.indicator, config.areaType, row.category],
      );

      if (config.areaColumn) {
        await conn.run(
          `
          INSERT INTO statistics
          SELECT
            ? AS indicator,
            ? AS area_type,
            ${quoteIdentifier(config.areaColumn)} AS area_name,
            CAST(${sqlYearExpr} AS INTEGER) AS year,
            CAST(value AS DOUBLE) AS value,
            ? AS unit,
            ? AS category
          FROM (
            SELECT *
            FROM raw
            WHERE ${indicatorColumn} = ?
          )
          UNPIVOT(value FOR year IN (${inList}));
          `,
          [row.indicator, config.areaType, row.unit, row.category, row.filterValue],
        );
      } else if (config.defaultAreaName) {
        await conn.run(
          `
          INSERT INTO statistics
          SELECT
            ? AS indicator,
            ? AS area_type,
            ? AS area_name,
            CAST(${sqlYearExpr} AS INTEGER) AS year,
            CAST(value AS DOUBLE) AS value,
            ? AS unit,
            ? AS category
          FROM (
            SELECT *
            FROM raw
            WHERE ${indicatorColumn} = ?
          )
          UNPIVOT(value FOR year IN (${inList}));
          `,
          [
            row.indicator,
            config.areaType,
            config.defaultAreaName,
            row.unit,
            row.category,
            row.filterValue,
          ],
        );
      } else {
        throw new Error(`Dataset ${config.id} requires either areaColumn or defaultAreaName`);
      }
    }

    await conn.run('COMMIT');
  } catch (err) {
    await conn.run('ROLLBACK');
    throw err;
  }

  let imported = 0;
  for (const row of format.rows) {
    const countRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [row.indicator, config.areaType, row.category],
    );
    imported += firstCellAsNumber(countRes.getRows(), 'imported statistics count');
  }

  return imported;
}

export async function importDataset(
  config: DatasetConfig,
  opts?: ImportDatasetOptions,
): Promise<ImportDatasetResult> {
  const started = nowMs();

  const env = getEnv();
  const { log, ctx } = getEtlLogger('import', config.id);
  const csvPath = opts?.csvPath ?? path.join(getCacheDir(), config.csvFilename);
  const dbPath = opts?.dbPath ?? getDuckDbPath(env);

  log.info(
    { ...ctx, csvPath, areaType: config.areaType, format: config.format.type },
    'etl.import: start',
  );

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
    const cols = info.getRowObjects().map((row) => String(row['name']));
    const yearCols = getYearColumns(cols, config);

    log.debug(
      { ...ctx, columns: cols.length, yearColumns: yearCols.length },
      'etl.import: detected columns',
    );

    let imported: number;
    if (config.format.type === 'unpivot_years') {
      imported = await importUnpivotYears({ conn, config, cols, yearCols, log, ctx });
    } else {
      throw new Error(`Unsupported CSV format: ${config.format.type}`);
    }

    log.info({ ...ctx, imported, ms: durationMs(started) }, 'etl.import: done');
    return { imported, csvPath, dbPath };
  } finally {
    conn.closeSync();
  }
}
