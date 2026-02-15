import { firstCellAsNumber, quoteIdentifier } from '../sql.js';

import { IMPORT_ROWS_TABLE_NAME } from './types.js';
import { buildParsedYearCaseExpr } from './yearParsing.js';

import type { ImportRunContext } from './types.js';
import type { DatasetConfig } from '../datasets/types.js';
import type { DuckDBConnection } from '@duckdb/node-api';

export function getYearColumns(columns: readonly string[], config: DatasetConfig): string[] {
  const format = config.format;
  if (format.type !== 'unpivot_years') return [];
  const yearPattern = format.yearPattern ?? /^\d{4}$/;
  return columns.filter((col) => yearPattern.test(col));
}

function buildSourceOrderCaseExpr(yearCols: readonly string[]): string {
  const clauses = yearCols
    .map((col, idx) => `WHEN '${col.replace(/'/g, "''")}' THEN ${String(idx)}`)
    .join(' ');
  return `CASE year_raw ${clauses} ELSE 0 END`;
}

export async function importUnpivotYears(args: {
  conn: DuckDBConnection;
  config: DatasetConfig;
  cols: readonly string[];
  yearCols: readonly string[];
  run: ImportRunContext;
}): Promise<number> {
  const { conn, config, cols, yearCols, run } = args;
  const format = config.format;
  const targetTable = quoteIdentifier(IMPORT_ROWS_TABLE_NAME);

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
    sourceAlias: 'year_raw',
    rawValues: yearCols,
  });
  const sourceOrderExpr = buildSourceOrderCaseExpr(yearCols);
  const projectedColumns = [
    indicatorColumn,
    ...(config.areaColumn ? [quoteIdentifier(config.areaColumn)] : []),
    ...yearCols.map((col) => `CAST(${quoteIdentifier(col)} AS VARCHAR) AS ${quoteIdentifier(col)}`),
  ].join(',\n          ');

  for (const row of format.rows) {
    const categorySlug = row.category.slug;
    const parsedValueExpr = row.valueExpression ? row.valueExpression : 'value';
    if (config.areaColumn) {
      const areaExpr = config.areaExpression ?? quoteIdentifier(config.areaColumn);
      await conn.run(
        `
        INSERT OR REPLACE INTO ${targetTable}
        SELECT
          indicator,
          area_type,
          area_name,
          year,
          value,
          unit,
          category,
          source_dataset,
          import_run_id,
          loaded_at,
          data_version
        FROM (
          SELECT
            ? AS indicator,
            ? AS area_type,
            ${areaExpr} AS area_name,
            CAST(${sqlYearExpr} AS INTEGER) AS year,
            TRY_CAST(${parsedValueExpr} AS DOUBLE) AS value,
            ? AS unit,
            ? AS category,
            ? AS source_dataset,
            ? AS import_run_id,
            CURRENT_TIMESTAMP AS loaded_at,
            ? AS data_version,
            ROW_NUMBER() OVER (
              PARTITION BY ${areaExpr}, CAST(${sqlYearExpr} AS INTEGER)
              ORDER BY ${sourceOrderExpr} DESC
            ) AS _year_pick
          FROM (
            SELECT ${projectedColumns}
            FROM raw
            WHERE ${indicatorColumn} = ?
          )
          UNPIVOT(value FOR year_raw IN (${inList}))
          WHERE TRY_CAST(${parsedValueExpr} AS DOUBLE) IS NOT NULL
        )
        WHERE _year_pick = 1;
        `,
        [
          row.indicator,
          config.areaType,
          row.unit,
          categorySlug,
          run.datasetId,
          run.runId,
          run.dataVersion,
          row.filterValue,
        ],
      );
    } else if (config.defaultAreaName) {
      await conn.run(
        `
        INSERT OR REPLACE INTO ${targetTable}
        SELECT
          indicator,
          area_type,
          area_name,
          year,
          value,
          unit,
          category,
          source_dataset,
          import_run_id,
          loaded_at,
          data_version
        FROM (
          SELECT
            ? AS indicator,
            ? AS area_type,
            ? AS area_name,
            CAST(${sqlYearExpr} AS INTEGER) AS year,
            TRY_CAST(${parsedValueExpr} AS DOUBLE) AS value,
            ? AS unit,
            ? AS category,
            ? AS source_dataset,
            ? AS import_run_id,
            CURRENT_TIMESTAMP AS loaded_at,
            ? AS data_version,
            ROW_NUMBER() OVER (
              PARTITION BY CAST(${sqlYearExpr} AS INTEGER)
              ORDER BY ${sourceOrderExpr} DESC
            ) AS _year_pick
          FROM (
            SELECT ${projectedColumns}
            FROM raw
            WHERE ${indicatorColumn} = ?
          )
          UNPIVOT(value FOR year_raw IN (${inList}))
          WHERE TRY_CAST(${parsedValueExpr} AS DOUBLE) IS NOT NULL
        )
        WHERE _year_pick = 1;
        `,
        [
          row.indicator,
          config.areaType,
          config.defaultAreaName,
          row.unit,
          categorySlug,
          run.datasetId,
          run.runId,
          run.dataVersion,
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
