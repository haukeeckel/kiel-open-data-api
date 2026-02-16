import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { createDb } from '../../infra/db/duckdb.js';
import { applyMigrations } from '../../infra/db/migrations.js';

import type { DuckDBConnection } from '@duckdb/node-api';

export function mkTmpDir(prefix = 'kiel-etl-'): string {
  return fssync.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export async function withConn(
  dbPath: string,
  fn: (conn: DuckDBConnection) => Promise<void>,
): Promise<void> {
  const db = await createDb(dbPath);
  const conn = await db.connect();
  try {
    await fn(conn);
  } finally {
    try {
      conn.closeSync();
    } catch {}
    try {
      db.closeSync();
    } catch {}
  }
}

export async function prepareMigratedDb(dbPath: string): Promise<void> {
  await withConn(dbPath, async (conn) => {
    await applyMigrations(conn);
  });
}

export async function copyDbSnapshot(fromBasePath: string, toBasePath: string): Promise<void> {
  await fs.copyFile(fromBasePath, toBasePath);

  for (const suffix of ['.wal', '.shm']) {
    const src = `${fromBasePath}${suffix}`;
    const dst = `${toBasePath}${suffix}`;
    try {
      await fs.copyFile(src, dst);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? (err as { code?: unknown }).code
          : undefined;
      if (code !== 'ENOENT') throw err;
    }
  }
}

export async function queryCategories(
  conn: DuckDBConnection,
  indicator: string,
  areaType: string,
): Promise<string[]> {
  const reader = await conn.runAndReadAll(
    `SELECT category FROM statistics WHERE indicator = ? AND area_type = ?
     GROUP BY category ORDER BY category ASC`,
    [indicator, areaType],
  );
  return reader.getRowObjects().map((row) => String(row['category']));
}

export async function queryYears(
  conn: DuckDBConnection,
  indicator: string,
  areaType: string,
  category = 'total',
): Promise<number[]> {
  const reader = await conn.runAndReadAll(
    `SELECT DISTINCT year FROM statistics
     WHERE indicator = ? AND area_type = ? AND category = ?
     ORDER BY year ASC`,
    [indicator, areaType, category],
  );
  return reader.getRowObjects().map((row) => Number(row['year']));
}

export async function queryAreas(
  conn: DuckDBConnection,
  indicator: string,
  areaType: string,
): Promise<string[]> {
  const reader = await conn.runAndReadAll(
    `SELECT DISTINCT area_name FROM statistics
     WHERE indicator = ? AND area_type = ?
     ORDER BY area_name ASC`,
    [indicator, areaType],
  );
  return reader.getRowObjects().map((row) => String(row['area_name']));
}

export async function queryValue(
  conn: DuckDBConnection,
  indicator: string,
  areaType: string,
  area: string,
  year: number,
  category = 'total',
): Promise<number> {
  const reader = await conn.runAndReadAll(
    `SELECT value FROM statistics
     WHERE indicator = ? AND area_type = ? AND area_name = ? AND year = ? AND category = ?`,
    [indicator, areaType, area, year, category],
  );
  return Number(reader.getRowObjects()[0]?.['value']);
}

export async function queryCount(
  conn: DuckDBConnection,
  indicator: string,
  areaType: string,
  category?: string,
): Promise<number> {
  const params: (string | number)[] = [indicator, areaType];
  let sql = `SELECT COUNT(*) AS c FROM statistics WHERE indicator = ? AND area_type = ?`;
  if (category !== undefined) {
    sql += ` AND category = ?`;
    params.push(category);
  }
  const reader = await conn.runAndReadAll(sql, params);
  return Number(reader.getRowObjects()[0]?.['c']);
}

export async function queryLatestRun(
  conn: DuckDBConnection,
  datasetId: string,
): Promise<{ status: string; rowCount: number | null; dataVersion: string; hasFailedAt: boolean }> {
  const reader = await conn.runAndReadAll(
    `
    SELECT status, row_count, data_version, failed_at
    FROM etl_runs
    WHERE dataset_id = ?
    ORDER BY started_at DESC
    LIMIT 1;
    `,
    [datasetId],
  );
  const row = reader.getRowObjects()[0];
  return {
    status: String(row?.['status']),
    rowCount: row?.['row_count'] === null ? null : Number(row?.['row_count']),
    dataVersion: String(row?.['data_version']),
    hasFailedAt: row?.['failed_at'] != null,
  };
}
