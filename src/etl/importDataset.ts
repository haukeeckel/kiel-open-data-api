import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { getEnv } from '../config/env.js';
import { getDuckDbPath, getCacheDir } from '../config/path.js';
import { createDb } from '../infra/db/duckdb.js';
import { applyMigrations } from '../infra/db/migrations.js';

import { durationMs, nowMs } from './etlContext.js';
import { getEtlLogger } from './etlLogger.js';
import { firstCellAsNumber, quoteIdentifier, quoteLiteral } from './sql.js';

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

function buildParsedYearCaseExpr(args: {
  datasetId: string;
  formatType: 'unpivot_years' | 'unpivot_categories';
  parser?: ((value: string) => number) | undefined;
  sourceAlias: 'year' | 'year_raw';
  rawValues: readonly string[];
}): string {
  const { datasetId, formatType, parser, sourceAlias, rawValues } = args;
  if (!parser) return sourceAlias;

  const cases = rawValues
    .map((raw) => {
      const parsed = parseYearOrThrow({
        raw,
        parseYear: parser,
        datasetId,
        formatType,
      });
      return `WHEN ${quoteLiteral(raw)} THEN ${String(parsed)}`;
    })
    .join(' ');
  return `CASE ${sourceAlias} ${cases} ELSE NULL END`;
}

function assertNever(x: never): never {
  throw new Error(`Unsupported CSV format: ${String((x as { type?: unknown }).type)}`);
}

async function deleteExistingCategoryRows(args: {
  conn: DuckDBConnection;
  targetTable: string;
  indicator: string;
  areaType: string;
  categorySlug: string;
  log: ReturnType<typeof getEtlLogger>['log'];
  ctx: ReturnType<typeof getEtlLogger>['ctx'];
}): Promise<void> {
  const { conn, targetTable, indicator, areaType, categorySlug, log, ctx } = args;
  const delRes = await conn.runAndReadAll(
    `SELECT COUNT(*) FROM ${targetTable} WHERE indicator = ? AND area_type = ? AND category = ?;`,
    [indicator, areaType, categorySlug],
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
    [indicator, areaType, categorySlug],
  );
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
  const sqlYearExpr = buildParsedYearCaseExpr({
    datasetId: config.id,
    formatType: 'unpivot_years',
    parser: format.yearParser,
    sourceAlias: 'year',
    rawValues: yearCols,
  });
  const projectedColumns = [
    indicatorColumn,
    ...(config.areaColumn ? [quoteIdentifier(config.areaColumn)] : []),
    ...yearCols.map((col) => `CAST(${quoteIdentifier(col)} AS VARCHAR) AS ${quoteIdentifier(col)}`),
  ].join(',\n          ');

  for (const row of format.rows) {
    const categorySlug = row.category.slug;
    await deleteExistingCategoryRows({
      conn,
      targetTable,
      indicator: row.indicator,
      areaType: config.areaType,
      categorySlug,
      log,
      ctx,
    });
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

  const sqlYearExpr = buildParsedYearCaseExpr({
    datasetId: config.id,
    formatType: 'unpivot_categories',
    parser: format.yearParser,
    sourceAlias: 'year_raw',
    rawValues: yearValues,
  });

  const plannedColumns = format.columns.map((column) => {
    const indicator = column.indicator ?? format.indicator;
    const unit = column.unit ?? format.unit;
    if (!indicator || !unit) {
      throw new Error(
        `Dataset ${config.id} requires indicator and unit for unpivot_categories column ${column.category.slug}`,
      );
    }
    const categorySlug = column.category.slug;
    const resolvedValueColumn = resolveValueColumn(column);
    if (!column.valueExpression && !resolvedValueColumn) {
      throw new Error(
        `Dataset ${config.id} requires valueColumn, valueColumns or valueExpression for category ${column.category.slug}`,
      );
    }
    const selectedValueColumn = resolvedValueColumn ?? column.valueColumn;
    let valueExpr: string;
    if (column.valueExpression) {
      valueExpr = column.valueExpression;
    } else {
      if (!selectedValueColumn) {
        throw new Error(
          `Dataset ${config.id} requires valueColumn, valueColumns or valueExpression for category ${column.category.slug}`,
        );
      }
      valueExpr = quoteIdentifier(selectedValueColumn);
    }
    return { indicator, unit, categorySlug, valueExpr };
  });

  for (const planned of plannedColumns) {
    await deleteExistingCategoryRows({
      conn,
      targetTable,
      indicator: planned.indicator,
      areaType: config.areaType,
      categorySlug: planned.categorySlug,
      log,
      ctx,
    });
  }

  for (const planned of plannedColumns) {
    const filterParts: string[] = [];
    const filterParams: Array<string | number> = [];

    if (format.filterColumn && format.filterValue !== undefined) {
      filterParts.push(`${quoteIdentifier(format.filterColumn)} = ?`);
      filterParams.push(format.filterValue);
    }
    filterParts.push(`TRY_CAST(${planned.valueExpr} AS DOUBLE) IS NOT NULL`);
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
          CAST(${planned.valueExpr} AS DOUBLE) AS value,
          ? AS unit,
          ? AS category
        FROM (
          SELECT *, ${quoteIdentifier(format.yearColumn)} AS year_raw
          FROM raw
          ${whereClause}
          ${dedupeClause}
        );
        `,
        [planned.indicator, config.areaType, planned.unit, planned.categorySlug, ...filterParams],
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
          CAST(${planned.valueExpr} AS DOUBLE) AS value,
          ? AS unit,
          ? AS category
        FROM (
          SELECT *, ${quoteIdentifier(format.yearColumn)} AS year_raw
          FROM raw
          ${whereClause}
          ${dedupeClause}
        );
        `,
        [
          planned.indicator,
          config.areaType,
          config.defaultAreaName,
          planned.unit,
          planned.categorySlug,
          ...filterParams,
        ],
      );
    } else {
      throw new Error(`Dataset ${config.id} requires either areaColumn or defaultAreaName`);
    }
  }

  let imported = 0;
  for (const planned of plannedColumns) {
    const countRes = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM ${targetTable} WHERE indicator = ? AND area_type = ? AND category = ?;`,
      [planned.indicator, config.areaType, planned.categorySlug],
    );
    imported += firstCellAsNumber(countRes.getRows(), 'imported statistics count');
  }
  return imported;
}

export async function importDataset(
  config: DatasetConfig,
  opts?: ImportDatasetOptions,
): Promise<ImportDatasetResult> {
  type ImportStep =
    | 'load_csv_temp_table'
    | 'normalize_headers'
    | 'prepare_stage_table'
    | 'transaction_import'
    | 'swap_stage_to_statistics';

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
  const stepTimings: Partial<Record<ImportStep, number>> = {};

  const runStep = async <T>(step: ImportStep, fn: () => Promise<T>): Promise<T> => {
    const stepStart = nowMs();
    try {
      const result = await fn();
      const ms = durationMs(stepStart);
      stepTimings[step] = ms;
      log.info({ ...ctx, step, ms }, 'etl.import: step done');
      return result;
    } catch (err) {
      stepTimings[step] = durationMs(stepStart);
      throw err;
    }
  };

  try {
    await applyMigrations(conn);

    await runStep('load_csv_temp_table', async () => {
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
    });

    const cols = await runStep('normalize_headers', async () => normalizeRawHeaders(conn));
    const yearCols = getYearColumns(cols, config);

    log.debug(
      { ...ctx, columns: cols.length, yearColumns: yearCols.length },
      'etl.import: detected columns',
    );

    await runStep('prepare_stage_table', async () => {
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
    });

    let imported: number;

    await conn.run('BEGIN TRANSACTION');
    try {
      imported = await runStep('transaction_import', async () => {
        if (config.format.type === 'unpivot_years') {
          return importUnpivotYears({
            conn,
            config,
            cols,
            yearCols,
            log,
            ctx,
            tableName: 'statistics_import_stage',
          });
        }
        if (config.format.type === 'unpivot_categories') {
          return importUnpivotCategories({
            conn,
            config,
            cols,
            log,
            ctx,
            tableName: 'statistics_import_stage',
          });
        }
        return assertNever(config.format);
      });
      await runStep('swap_stage_to_statistics', async () => {
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
      });
      await conn.run('COMMIT');
    } catch (err) {
      try {
        await conn.run('ROLLBACK');
      } catch {}
      throw err;
    }

    log.info({ ...ctx, imported, ms: durationMs(started), stepTimings }, 'etl.import: done');
    return { imported, csvPath, dbPath };
  } catch (err) {
    log.error({ ...ctx, err, ms: durationMs(started), stepTimings }, 'etl.import: failed');
    throw err;
  } finally {
    try {
      conn.closeSync();
    } catch {}
    try {
      db.closeSync();
    } catch {}
  }
}
