import * as crypto from 'node:crypto';

import type { DuckDBConnection } from '@duckdb/node-api';

export async function createImportRun(args: {
  conn: DuckDBConnection;
  datasetId: string;
  dataVersion: string;
}): Promise<{ runId: string; datasetId: string; dataVersion: string }> {
  const runId = crypto.randomUUID();
  const { conn, datasetId, dataVersion } = args;

  await conn.run(
    `
    INSERT INTO etl_runs (run_id, dataset_id, data_version, status)
    VALUES (?, ?, ?, 'started');
    `,
    [runId, datasetId, dataVersion],
  );

  return { runId, datasetId, dataVersion };
}

export async function markImportRunPublished(args: {
  conn: DuckDBConnection;
  runId: string;
  rowCount: number;
}): Promise<void> {
  const { conn, runId, rowCount } = args;
  await conn.run(
    `
    UPDATE etl_runs
    SET status = 'published',
        published_at = CURRENT_TIMESTAMP,
        row_count = ?
    WHERE run_id = ?;
    `,
    [rowCount, runId],
  );
}

export async function markImportRunFailed(args: {
  conn: DuckDBConnection;
  runId: string;
  errorMessage: string;
}): Promise<void> {
  const { conn, runId, errorMessage } = args;
  await conn.run(
    `
    UPDATE etl_runs
    SET status = 'failed',
        failed_at = CURRENT_TIMESTAMP,
        error_message = ?
    WHERE run_id = ?;
    `,
    [errorMessage.slice(0, 2000), runId],
  );
}
