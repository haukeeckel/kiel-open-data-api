import { firstCellAsNumber, quoteIdentifier } from '../sql.js';

import { IMPORT_ROWS_TABLE_NAME } from './types.js';

import type { DatasetScopeKey } from './types.js';
import type { DatasetConfig } from '../datasets/types.js';
import type { DuckDBConnection } from '@duckdb/node-api';

function assertNever(x: never): never {
  throw new Error(`Unsupported CSV format: ${String((x as { type?: unknown }).type)}`);
}

function getDatasetScopeKeys(config: DatasetConfig): DatasetScopeKey[] {
  const format = config.format;
  if (format.type === 'unpivot_years') {
    return format.rows.map((row) => ({
      indicator: row.indicator,
      categorySlug: row.category.slug,
    }));
  }
  if (format.type === 'unpivot_categories') {
    return format.columns.map((column) => {
      const indicator = column.indicator ?? format.indicator;
      if (!indicator) {
        throw new Error(
          `Dataset ${config.id} requires indicator for unpivot_categories column ${column.category.slug}`,
        );
      }
      return { indicator, categorySlug: column.category.slug };
    });
  }
  return assertNever(format);
}

export async function deleteStaleRowsForDataset(args: {
  conn: DuckDBConnection;
  config: DatasetConfig;
  log: {
    info: (obj: Record<string, unknown>, msg: string) => void;
  };
  ctx: Record<string, unknown>;
}): Promise<void> {
  const { conn, config, log, ctx } = args;
  const targetTable = quoteIdentifier('statistics');
  const importTable = quoteIdentifier(IMPORT_ROWS_TABLE_NAME);

  for (const key of getDatasetScopeKeys(config)) {
    const staleCountReader = await conn.runAndReadAll(
      `
      SELECT COUNT(*) FROM ${targetTable} AS s
      WHERE s.indicator = ? AND s.area_type = ? AND s.category = ?
        AND NOT EXISTS (
          SELECT 1
          FROM ${importTable} AS st
          WHERE st.indicator = s.indicator
            AND st.area_type = s.area_type
            AND st.area_name = s.area_name
            AND st.year = s.year
            AND st.category = s.category
        );
      `,
      [key.indicator, config.areaType, key.categorySlug],
    );
    const stale = firstCellAsNumber(staleCountReader.getRows(), 'stale statistics count');
    if (stale > 0) {
      log.info(
        { ...ctx, indicator: key.indicator, category: key.categorySlug, stale },
        'etl.import: deleting stale rows',
      );
    }
    await conn.run(
      `
      DELETE FROM ${targetTable} AS s
      WHERE s.indicator = ? AND s.area_type = ? AND s.category = ?
        AND NOT EXISTS (
          SELECT 1
          FROM ${importTable} AS st
          WHERE st.indicator = s.indicator
            AND st.area_type = s.area_type
            AND st.area_name = s.area_name
            AND st.year = s.year
            AND st.category = s.category
        );
      `,
      [key.indicator, config.areaType, key.categorySlug],
    );
  }
}
