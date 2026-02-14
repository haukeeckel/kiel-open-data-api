import type { DatasetConfig } from '../datasets/types.js';
import type { DuckDBConnection } from '@duckdb/node-api';

export const IMPORT_ROWS_TABLE_NAME = 'statistics_import_rows';
export const MIN_VALID_YEAR = 1900;
export const MAX_VALID_YEAR = 2100;

export type DatasetScopeKey = {
  indicator: string;
  categorySlug: string;
};

export type ImportRunStatus = 'started' | 'published' | 'failed';

export type ImportRunContext = {
  runId: string;
  datasetId: string;
  dataVersion: string;
};

export type ImportRuntimeContext = {
  conn: DuckDBConnection;
  config: DatasetConfig;
  cols: readonly string[];
  yearCols: readonly string[];
  run: ImportRunContext;
};
