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
  if (format.type !== 'unpivot_years') return [];
  const yearPattern = format.yearPattern ?? /^\d{4}$/;
  return columns.filter((col) => yearPattern.test(col));
}

function yearExpr(config: DatasetConfig, yearCols: readonly string[]): string {
  if (config.format.type !== 'unpivot_years') return 'year';
  const parseYear = config.format.yearParser;
  if (!parseYear) return 'year';

  const cases = yearCols
    .map((col) => `WHEN ${quoteLiteral(col)} THEN ${String(parseYear(col))}`)
    .join(' ');
  return `CASE year ${cases} ELSE NULL END`;
}

function yearValueExpr(args: {
  yearValues: readonly string[];
  parseYear?: ((value: string) => number) | undefined;
}): string {
  const { yearValues, parseYear } = args;
  if (!parseYear) return 'year_raw';

  const cases = yearValues
    .map((value) => `WHEN ${quoteLiteral(value)} THEN ${String(parseYear(value))}`)
    .join(' ');
  return `CASE year_raw ${cases} ELSE NULL END`;
}

function assertNever(x: never): never {
  throw new Error(`Unsupported CSV format: ${String((x as { type?: unknown }).type)}`);
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
  const projectedColumns = [
    indicatorColumn,
    ...(config.areaColumn ? [quoteIdentifier(config.areaColumn)] : []),
    ...yearCols.map((col) => `CAST(${quoteIdentifier(col)} AS VARCHAR) AS ${quoteIdentifier(col)}`),
  ].join(',\n          ');

  for (const row of format.rows) {
    const categorySlug = row.category.slug;
    const delRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [row.indicator, config.areaType, categorySlug],
    );
    const existing = firstCellAsNumber(delRes.getRows(), 'existing statistics count');
    if (existing > 0) {
      log.info(
        { ...ctx, indicator: row.indicator, category: categorySlug, existing },
        'etl.import: deleting existing rows',
      );
    }

    await conn.run(
      `DELETE FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [row.indicator, config.areaType, categorySlug],
    );
  }

  for (const row of format.rows) {
    const categorySlug = row.category.slug;
    const parsedValueExpr = row.valueExpression ? row.valueExpression : 'value';
    if (config.areaColumn) {
      await conn.run(
        `
        INSERT INTO statistics
        SELECT
          ? AS indicator,
          ? AS area_type,
          ${quoteIdentifier(config.areaColumn)} AS area_name,
          CAST(${sqlYearExpr} AS INTEGER) AS year,
          TRY_CAST(${parsedValueExpr} AS DOUBLE) AS value,
          ? AS unit,
          ? AS category
        FROM (
          SELECT ${projectedColumns}
          FROM raw
          WHERE ${indicatorColumn} = ?
        )
        UNPIVOT(value FOR year IN (${inList}))
        WHERE TRY_CAST(${parsedValueExpr} AS DOUBLE) IS NOT NULL;
        `,
        [row.indicator, config.areaType, row.unit, categorySlug, row.filterValue],
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
          TRY_CAST(${parsedValueExpr} AS DOUBLE) AS value,
          ? AS unit,
          ? AS category
        FROM (
          SELECT ${projectedColumns}
          FROM raw
          WHERE ${indicatorColumn} = ?
        )
        UNPIVOT(value FOR year IN (${inList}))
        WHERE TRY_CAST(${parsedValueExpr} AS DOUBLE) IS NOT NULL;
        `,
        [
          row.indicator,
          config.areaType,
          config.defaultAreaName,
          row.unit,
          categorySlug,
          row.filterValue,
        ],
      );
    } else {
      throw new Error(`Dataset ${config.id} requires either areaColumn or defaultAreaName`);
    }
  }

  let imported = 0;
  for (const row of format.rows) {
    const categorySlug = row.category.slug;
    const countRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [row.indicator, config.areaType, categorySlug],
    );
    imported += firstCellAsNumber(countRes.getRows(), 'imported statistics count');
  }

  return imported;
}

async function importUnpivotCategories(args: {
  conn: DuckDBConnection;
  config: DatasetConfig;
  cols: readonly string[];
  log: ReturnType<typeof getEtlLogger>['log'];
  ctx: ReturnType<typeof getEtlLogger>['ctx'];
}): Promise<number> {
  const { conn, config, cols, log, ctx } = args;
  const format = config.format;

  if (format.type !== 'unpivot_categories') {
    throw new Error(`Unsupported CSV format: ${format.type}`);
  }

  const requiredCols = [format.yearColumn];
  if (config.areaColumn) requiredCols.push(config.areaColumn);
  if (format.filterColumn) requiredCols.push(format.filterColumn);
  requiredCols.push(
    ...format.columns
      .map((column) => column.valueColumn)
      .filter((value): value is string => value !== undefined),
  );

  const missing = requiredCols.filter((col) => !cols.includes(col));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  const yearValuesReader = await conn.runAndReadAll(
    `SELECT DISTINCT ${quoteIdentifier(format.yearColumn)} AS year_raw
     FROM raw
     WHERE ${quoteIdentifier(format.yearColumn)} IS NOT NULL
     ORDER BY ${quoteIdentifier(format.yearColumn)} ASC;`,
  );
  const yearValues = yearValuesReader.getRowObjects().map((row) => String(row['year_raw']));
  if (yearValues.length === 0) {
    throw new Error(`No year values found in column: ${format.yearColumn}`);
  }

  const sqlYearExpr = yearValueExpr({ yearValues, parseYear: format.yearParser });

  for (const column of format.columns) {
    if (!column.valueColumn && !column.valueExpression) {
      throw new Error(
        `Dataset ${config.id} requires valueColumn or valueExpression for category ${column.category.slug}`,
      );
    }

    const indicator = column.indicator ?? format.indicator;
    const unit = column.unit ?? format.unit;
    if (!indicator || !unit) {
      throw new Error(
        `Dataset ${config.id} requires indicator and unit for unpivot_categories column ${column.valueColumn}`,
      );
    }

    const categorySlug = column.category.slug;
    const delRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [indicator, config.areaType, categorySlug],
    );
    const existing = firstCellAsNumber(delRes.getRows(), 'existing statistics count');
    if (existing > 0) {
      log.info(
        { ...ctx, indicator, category: categorySlug, existing },
        'etl.import: deleting existing rows',
      );
    }

    await conn.run(
      `DELETE FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [indicator, config.areaType, categorySlug],
    );
  }

  for (const column of format.columns) {
    if (!column.valueColumn && !column.valueExpression) continue;
    const indicator = column.indicator ?? format.indicator;
    const unit = column.unit ?? format.unit;
    if (!indicator || !unit) continue;

    const categorySlug = column.category.slug;
    const valueExpr = column.valueExpression
      ? column.valueExpression
      : quoteIdentifier(column.valueColumn ?? '');
    const filterParts: string[] = [];
    const filterParams: Array<string | number> = [];

    if (format.filterColumn && format.filterValue !== undefined) {
      filterParts.push(`${quoteIdentifier(format.filterColumn)} = ?`);
      filterParams.push(format.filterValue);
    }
    filterParts.push(`TRY_CAST(${valueExpr} AS DOUBLE) IS NOT NULL`);
    if (config.areaColumn) {
      filterParts.push(`${quoteIdentifier(config.areaColumn)} IS NOT NULL`);
    }
    const whereClause = filterParts.length > 0 ? `WHERE ${filterParts.join(' AND ')}` : '';
    const dedupeClause = format.dedupeByAreaYearKeepLast
      ? `QUALIFY ROW_NUMBER() OVER (
           PARTITION BY ${
             config.areaColumn
               ? `${quoteIdentifier(config.areaColumn)}, ${quoteIdentifier(format.yearColumn)}`
               : `${quoteIdentifier(format.yearColumn)}`
           }
           ORDER BY rowid DESC
         ) = 1`
      : '';

    if (config.areaColumn) {
      await conn.run(
        `
        INSERT INTO statistics
        SELECT
          ? AS indicator,
          ? AS area_type,
          ${quoteIdentifier(config.areaColumn)} AS area_name,
          CAST(${sqlYearExpr} AS INTEGER) AS year,
          CAST(${valueExpr} AS DOUBLE) AS value,
          ? AS unit,
          ? AS category
        FROM (
          SELECT *, ${quoteIdentifier(format.yearColumn)} AS year_raw
          FROM raw
          ${whereClause}
          ${dedupeClause}
        );
        `,
        [indicator, config.areaType, unit, categorySlug, ...filterParams],
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
          CAST(${valueExpr} AS DOUBLE) AS value,
          ? AS unit,
          ? AS category
        FROM (
          SELECT *, ${quoteIdentifier(format.yearColumn)} AS year_raw
          FROM raw
          ${whereClause}
          ${dedupeClause}
        );
        `,
        [indicator, config.areaType, config.defaultAreaName, unit, categorySlug, ...filterParams],
      );
    } else {
      throw new Error(`Dataset ${config.id} requires either areaColumn or defaultAreaName`);
    }
  }

  let imported = 0;
  for (const column of format.columns) {
    const indicator = column.indicator ?? format.indicator;
    if (!indicator) continue;

    const countRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [indicator, config.areaType, column.category.slug],
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
    } else if (config.format.type === 'unpivot_categories') {
      imported = await importUnpivotCategories({ conn, config, cols, log, ctx });
    } else {
      return assertNever(config.format);
    }

    log.info({ ...ctx, imported, ms: durationMs(started) }, 'etl.import: done');
    return { imported, csvPath, dbPath };
  } finally {
    conn.closeSync();
  }
}
