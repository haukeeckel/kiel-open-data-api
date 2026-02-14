import { quoteIdentifier } from '../sql.js';

import { IMPORT_ROWS_TABLE_NAME } from './types.js';
import { importUnpivotCategories } from './unpivotCategories.js';
import { getYearColumns, importUnpivotYears } from './unpivotYears.js';

import type { ImportRunContext } from './types.js';
import type { DatasetConfig } from '../datasets/types.js';
import type { DuckDBConnection } from '@duckdb/node-api';

function assertNever(x: never): never {
  throw new Error(`Unsupported CSV format: ${String((x as { type?: unknown }).type)}`);
}

export function createImportRowsTempTableSql(): string {
  return `
    CREATE OR REPLACE TEMP TABLE ${quoteIdentifier(IMPORT_ROWS_TABLE_NAME)} (
      indicator TEXT,
      area_type TEXT,
      area_name TEXT,
      year INTEGER,
      value DOUBLE,
      unit TEXT,
      category TEXT,
      source_dataset TEXT,
      import_run_id TEXT,
      loaded_at TIMESTAMP,
      data_version TEXT
    );
  `;
}

export async function importIntoStage(args: {
  conn: DuckDBConnection;
  config: DatasetConfig;
  cols: readonly string[];
  run: ImportRunContext;
}): Promise<{ imported: number; yearCols: readonly string[] }> {
  const { conn, config, cols, run } = args;
  const yearCols = getYearColumns(cols, config);

  await conn.run(createImportRowsTempTableSql());
  await conn.run(
    `DROP INDEX IF EXISTS ${quoteIdentifier(`${IMPORT_ROWS_TABLE_NAME}_unique_idx`)};`,
  );
  await conn.run(`
    CREATE UNIQUE INDEX ${quoteIdentifier(`${IMPORT_ROWS_TABLE_NAME}_unique_idx`)}
    ON ${quoteIdentifier(IMPORT_ROWS_TABLE_NAME)}(indicator, area_type, area_name, year, category);
  `);

  const imported = await (async () => {
    if (config.format.type === 'unpivot_years') {
      return importUnpivotYears({
        conn,
        config,
        cols,
        yearCols,
        run,
      });
    }
    if (config.format.type === 'unpivot_categories') {
      return importUnpivotCategories({
        conn,
        config,
        cols,
        run,
      });
    }
    return assertNever(config.format);
  })();

  return { imported, yearCols };
}
