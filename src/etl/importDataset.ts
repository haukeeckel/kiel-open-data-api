import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { getEnv } from '../config/env.js';
import { getDuckDbPath, getCacheDir } from '../config/path.js';
import { createDb } from '../infra/db/duckdb.js';
import { assertMigrationsUpToDate } from '../infra/db/migrations.js';

import { CsvFileNotFoundError } from './errors.js';
import { durationMs, nowMs } from './etlContext.js';
import { getEtlLogger } from './etlLogger.js';
import { normalizeRawHeaders } from './import/headerNormalization.js';
import { importIntoStage } from './import/pipeline.js';
import {
  createImportRun,
  markImportRunFailed,
  markImportRunPublished,
} from './import/runLifecycle.js';
import { deleteStaleRowsForDataset } from './import/staleCleanup.js';
import { IMPORT_ROWS_TABLE_NAME } from './import/types.js';
import { quoteIdentifier } from './sql.js';

import type { DatasetConfig } from './datasets/types.js';
import type { ImportRunContext } from './import/types.js';

export type ImportDatasetOptions = {
  csvPath?: string | undefined;
  dbPath?: string | undefined;
};

export type ImportDatasetResult = {
  imported: number;
  csvPath: string;
  dbPath: string;
};

async function resolveDataVersion(csvPath: string): Promise<string> {
  const stat = await fs.stat(csvPath);
  return `size:${stat.size};mtimeMs:${Math.trunc(stat.mtimeMs)}`;
}

export async function importDataset(
  config: DatasetConfig,
  opts?: ImportDatasetOptions,
): Promise<ImportDatasetResult> {
  type ImportStep =
    | 'run_create'
    | 'load_csv_temp_table'
    | 'normalize_headers'
    | 'transaction_delete_scope'
    | 'transaction_insert_rows';

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
    throw new CsvFileNotFoundError(csvPath);
  }

  const dbLogger = log.child({ name: 'db' });
  const db = await createDb(dbPath, { logger: dbLogger });
  const conn = await db.connect();
  const stepTimings: Partial<Record<ImportStep, number>> = {};
  let run: ImportRunContext | undefined;

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
    await assertMigrationsUpToDate(conn);

    run = await runStep('run_create', async () => {
      const dataVersion = await resolveDataVersion(csvPath);
      return createImportRun({ conn, datasetId: config.id, dataVersion });
    });
    const runCtx = run;
    if (!runCtx) {
      throw new Error(`Failed to initialize import run for dataset ${config.id}`);
    }

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

    const { imported, yearCols } = await runStep('transaction_insert_rows', async () => {
      return importIntoStage({
        conn,
        config,
        cols,
        run: runCtx,
      });
    });

    log.debug(
      { ...ctx, columns: cols.length, yearColumns: yearCols.length },
      'etl.import: detected columns',
    );

    if (imported === 0) {
      throw new Error(
        `ETL import produced zero rows for dataset ${config.id}. ` +
          `Aborting publish to preserve existing data.`,
      );
    }

    await conn.run('BEGIN TRANSACTION');
    try {
      await conn.run(`
        INSERT OR REPLACE INTO statistics (
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
        )
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
        FROM ${quoteIdentifier(IMPORT_ROWS_TABLE_NAME)};
      `);

      await runStep('transaction_delete_scope', async () => {
        await deleteStaleRowsForDataset({ conn, config, log, ctx });
      });

      await markImportRunPublished({ conn, runId: run.runId, rowCount: imported });
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
    if (run) {
      try {
        await markImportRunFailed({
          conn,
          runId: run.runId,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      } catch {}
    }
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
