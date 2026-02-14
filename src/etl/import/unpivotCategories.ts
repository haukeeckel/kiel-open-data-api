import { firstCellAsNumber, quoteIdentifier } from '../sql.js';

import { IMPORT_ROWS_TABLE_NAME } from './types.js';
import { buildParsedYearCaseExpr } from './yearParsing.js';

import type { ImportRunContext } from './types.js';
import type { DatasetConfig } from '../datasets/types.js';
import type { DuckDBConnection } from '@duckdb/node-api';

export async function importUnpivotCategories(args: {
  conn: DuckDBConnection;
  config: DatasetConfig;
  cols: readonly string[];
  run: ImportRunContext;
}): Promise<number> {
  const { conn, config, cols, run } = args;
  const format = config.format;
  const targetTable = quoteIdentifier(IMPORT_ROWS_TABLE_NAME);

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
        INSERT OR REPLACE INTO ${targetTable}
        SELECT
          ? AS indicator,
          ? AS area_type,
          ${areaExpr} AS area_name,
          CAST(${sqlYearExpr} AS INTEGER) AS year,
          CAST(${planned.valueExpr} AS DOUBLE) AS value,
          ? AS unit,
          ? AS category,
          ? AS source_dataset,
          ? AS import_run_id,
          CURRENT_TIMESTAMP AS loaded_at,
          ? AS data_version
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
          planned.unit,
          planned.categorySlug,
          run.datasetId,
          run.runId,
          run.dataVersion,
          ...filterParams,
        ],
      );
    } else if (config.defaultAreaName) {
      await conn.run(
        `
        INSERT OR REPLACE INTO ${targetTable}
        SELECT
          ? AS indicator,
          ? AS area_type,
          ? AS area_name,
          CAST(${sqlYearExpr} AS INTEGER) AS year,
          CAST(${planned.valueExpr} AS DOUBLE) AS value,
          ? AS unit,
          ? AS category,
          ? AS source_dataset,
          ? AS import_run_id,
          CURRENT_TIMESTAMP AS loaded_at,
          ? AS data_version
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
          run.datasetId,
          run.runId,
          run.dataVersion,
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
