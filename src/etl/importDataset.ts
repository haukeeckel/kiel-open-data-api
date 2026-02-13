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

const MIN_VALID_YEAR = 1900;
const MAX_VALID_YEAR = 2100;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function parseYearOrThrow(args: {
  raw: string;
  parseYear: (value: string) => number;
  datasetId: string;
  formatType: 'unpivot_years' | 'unpivot_categories';
}): number {
  const parsed = args.parseYear(args.raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(
      `Invalid yearParser output for dataset ${args.datasetId} (${args.formatType}): ` +
        `input=${args.raw}, output=${String(parsed)}, allowedRange=${MIN_VALID_YEAR}..${MAX_VALID_YEAR}`,
    );
  }
  if (parsed < MIN_VALID_YEAR || parsed > MAX_VALID_YEAR) {
    throw new Error(
      `Invalid yearParser output for dataset ${args.datasetId} (${args.formatType}): ` +
        `input=${args.raw}, output=${String(parsed)}, allowedRange=${MIN_VALID_YEAR}..${MAX_VALID_YEAR}`,
    );
  }
  return parsed;
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
    .map((col) => {
      const parsed = parseYearOrThrow({
        raw: col,
        parseYear,
        datasetId: config.id,
        formatType: 'unpivot_years',
      });
      return `WHEN ${quoteLiteral(col)} THEN ${String(parsed)}`;
    })
    .join(' ');
  return `CASE year ${cases} ELSE NULL END`;
}

function yearValueExpr(args: {
  datasetId: string;
  yearValues: readonly string[];
  parseYear?: ((value: string) => number) | undefined;
}): string {
  const { datasetId, yearValues, parseYear } = args;
  if (!parseYear) return 'year_raw';

  const cases = yearValues
    .map((value) => {
      const parsed = parseYearOrThrow({
        raw: value,
        parseYear,
        datasetId,
        formatType: 'unpivot_categories',
      });
      return `WHEN ${quoteLiteral(value)} THEN ${String(parsed)}`;
    })
    .join(' ');
  return `CASE year_raw ${cases} ELSE NULL END`;
}

function assertNever(x: never): never {
  throw new Error(`Unsupported CSV format: ${String((x as { type?: unknown }).type)}`);
}

async function normalizeRawHeaders(conn: DuckDBConnection): Promise<string[]> {
  const info = await conn.runAndReadAll(`PRAGMA table_info('raw');`);
  const columns = info.getRowObjects().map((row) => String(row['name']));
  const normalized = columns.map((name) => name.trim());

  const changed = columns.some((name, idx) => name !== normalized[idx]);
  if (!changed) return columns;

  const duplicates = new Map<string, string[]>();
  for (let i = 0; i < columns.length; i += 1) {
    const key = normalized[i] ?? '';
    const existing = duplicates.get(key) ?? [];
    existing.push(columns[i] ?? '');
    duplicates.set(key, existing);
  }
  const collisions = [...duplicates.entries()]
    .filter(([, originals]) => originals.length > 1)
    .map(([trimmed, originals]) => `${trimmed} <- [${originals.join(', ')}]`);
  if (collisions.length > 0) {
    throw new Error(`Header normalization collision: ${collisions.join('; ')}`);
  }

  const projection = columns
    .map((name, idx) => `${quoteIdentifier(name)} AS ${quoteIdentifier(normalized[idx] ?? '')}`)
    .join(', ');
  await conn.run(`
    CREATE OR REPLACE TEMP TABLE raw AS
    SELECT ${projection}
    FROM raw;
  `);
  return normalized;
}

async function importUnpivotYears(args: {
  conn: DuckDBConnection;
  config: DatasetConfig;
  cols: readonly string[];
  yearCols: readonly string[];
  log: ReturnType<typeof getEtlLogger>['log'];
  ctx: ReturnType<typeof getEtlLogger>['ctx'];
  tableName?: string | undefined;
}): Promise<number> {
  const { conn, config, cols, yearCols, log, ctx } = args;
  const format = config.format;
  const targetTable = quoteIdentifier(args.tableName ?? 'statistics');

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
      `SELECT COUNT(*) FROM ${targetTable} WHERE indicator = ? AND area_type = ? AND category = ?;`,
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
      `DELETE FROM ${targetTable} WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [row.indicator, config.areaType, categorySlug],
    );
  }

  for (const row of format.rows) {
    const categorySlug = row.category.slug;
    const parsedValueExpr = row.valueExpression ? row.valueExpression : 'value';
    if (config.areaColumn) {
      const areaExpr = config.areaExpression ?? quoteIdentifier(config.areaColumn);
      await conn.run(
        `
        INSERT INTO ${targetTable}
        SELECT
          ? AS indicator,
          ? AS area_type,
          ${areaExpr} AS area_name,
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
        INSERT INTO ${targetTable}
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
      `SELECT COUNT(*) FROM ${targetTable} WHERE indicator = ? AND area_type = ? AND category = ?;`,
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
  tableName?: string | undefined;
}): Promise<number> {
  const { conn, config, cols, log, ctx } = args;
  const format = config.format;
  const targetTable = quoteIdentifier(args.tableName ?? 'statistics');

  if (format.type !== 'unpivot_categories') {
    throw new Error(`Unsupported CSV format: ${format.type}`);
  }

  const resolveValueColumn = (column: (typeof format.columns)[number]): string | undefined => {
    if (column.valueColumn) return column.valueColumn;
    if (!column.valueColumns || column.valueColumns.length === 0) return undefined;
    return column.valueColumns.find((candidate) => cols.includes(candidate));
  };

  const requiredCols = [format.yearColumn];
  if (config.areaColumn) requiredCols.push(config.areaColumn);
  if (format.filterColumn) requiredCols.push(format.filterColumn);
  requiredCols.push(
    ...format.columns
      .map((column) => resolveValueColumn(column) ?? column.valueColumn)
      .filter((value): value is string => value !== undefined),
  );

  const missing = requiredCols.filter((col) => !cols.includes(col));
  const missingAlternatives = format.columns
    .filter(
      (column) =>
        !column.valueExpression &&
        !column.valueColumn &&
        column.valueColumns &&
        column.valueColumns.length > 0 &&
        resolveValueColumn(column) === undefined,
    )
    .map((column) => `[${column.valueColumns?.join(' | ')}] for ${column.category.slug}`);
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }
  if (missingAlternatives.length > 0) {
    throw new Error(`Missing required columns: ${missingAlternatives.join(', ')}`);
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

  const sqlYearExpr = yearValueExpr({
    datasetId: config.id,
    yearValues,
    parseYear: format.yearParser,
  });

  for (const column of format.columns) {
    if (!column.valueColumn && !column.valueColumns && !column.valueExpression) {
      throw new Error(
        `Dataset ${config.id} requires valueColumn or valueExpression for category ${column.category.slug}`,
      );
    }

    const indicator = column.indicator ?? format.indicator;
    const unit = column.unit ?? format.unit;
    if (!indicator || !unit) {
      throw new Error(
        `Dataset ${config.id} requires indicator and unit for unpivot_categories column ${column.category.slug}`,
      );
    }

    const categorySlug = column.category.slug;
    const delRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM ${targetTable} WHERE indicator = ? AND area_type = ? AND category = ?;`,
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
      `DELETE FROM ${targetTable} WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [indicator, config.areaType, categorySlug],
    );
  }

  for (const column of format.columns) {
    const indicator = column.indicator ?? format.indicator;
    const unit = column.unit ?? format.unit;
    if (!indicator || !unit) {
      throw new Error(
        `Dataset ${config.id} requires indicator and unit for unpivot_categories column ${column.category.slug}`,
      );
    }

    const categorySlug = column.category.slug;
    const resolvedValueColumn = resolveValueColumn(column);
    const valueExpr = column.valueExpression
      ? column.valueExpression
      : quoteIdentifier(resolvedValueColumn ?? column.valueColumn ?? '');
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
           ORDER BY _ingest_order DESC
         ) = 1`
      : '';

    if (config.areaColumn) {
      const areaExpr = config.areaExpression ?? quoteIdentifier(config.areaColumn);
      await conn.run(
        `
        INSERT INTO ${targetTable}
        SELECT
          ? AS indicator,
          ? AS area_type,
          ${areaExpr} AS area_name,
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
        INSERT INTO ${targetTable}
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
      `SELECT COUNT(*) FROM ${targetTable} WHERE indicator = ? AND area_type = ? AND category = ?;`,
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
  const csvDelimiter = config.csvDelimiter ?? ';';

  if (csvDelimiter.length !== 1) {
    throw new Error(
      `Dataset ${config.id} has invalid csvDelimiter: ${csvDelimiter} (expected single character)`,
    );
  }

  log.info(
    { ...ctx, csvPath, areaType: config.areaType, format: config.format.type, csvDelimiter },
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

    await conn.run(
      `
      CREATE OR REPLACE TEMP TABLE raw AS
      SELECT
        *,
        row_number() OVER () AS _ingest_order
      FROM read_csv_auto(?, header=true, delim=?);
    `,
      [csvPath, csvDelimiter],
    );

    const cols = await normalizeRawHeaders(conn);
    const yearCols = getYearColumns(cols, config);

    log.debug(
      { ...ctx, columns: cols.length, yearColumns: yearCols.length },
      'etl.import: detected columns',
    );

    let imported: number;
    await conn.run(`
      CREATE OR REPLACE TEMP TABLE statistics_import_stage (
        indicator TEXT,
        area_type TEXT,
        area_name TEXT,
        year INTEGER,
        value DOUBLE,
        unit TEXT,
        category TEXT
      );
    `);
    await conn.run(`INSERT INTO statistics_import_stage SELECT * FROM statistics;`);

    await conn.run('BEGIN TRANSACTION');
    try {
      if (config.format.type === 'unpivot_years') {
        imported = await importUnpivotYears({
          conn,
          config,
          cols,
          yearCols,
          log,
          ctx,
          tableName: 'statistics_import_stage',
        });
      } else if (config.format.type === 'unpivot_categories') {
        imported = await importUnpivotCategories({
          conn,
          config,
          cols,
          log,
          ctx,
          tableName: 'statistics_import_stage',
        });
      } else {
        return assertNever(config.format);
      }
      await conn.run(`
        INSERT OR REPLACE INTO statistics
        SELECT * FROM statistics_import_stage;
      `);
      await conn.run(`
        DELETE FROM statistics AS s
        WHERE NOT EXISTS (
          SELECT 1
          FROM statistics_import_stage AS st
          WHERE st.indicator = s.indicator
            AND st.area_type = s.area_type
            AND st.area_name = s.area_name
            AND st.year = s.year
            AND st.category = s.category
        );
      `);
      await conn.run('COMMIT');
    } catch (err) {
      try {
        await conn.run('ROLLBACK');
      } catch {}
      throw err;
    }

    log.info({ ...ctx, imported, ms: durationMs(started) }, 'etl.import: done');
    return { imported, csvPath, dbPath };
  } finally {
    try {
      conn.closeSync();
    } catch {}
    try {
      db.closeSync();
    } catch {}
  }
}
