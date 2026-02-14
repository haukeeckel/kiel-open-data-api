import { pathToFileURL } from 'node:url';

import { getEnv } from '../../config/env.js';
import { getDuckDbPath } from '../../config/path.js';
import { createDb } from '../../infra/db/duckdb.js';
import { assertMigrationsUpToDate } from '../../infra/db/migrations.js';
import { flushLogger } from '../../logger/flush.js';
import { getEtlLogger } from '../etlLogger.js';

import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

function isDirectCliEntry(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return importMetaUrl === pathToFileURL(entry).href;
}

function usage(): string {
  return 'Usage: tsx src/etl/cli/maint.ts --dry-run';
}

export async function runCli(argv: readonly string[]): Promise<number> {
  const { log } = getEtlLogger('run', 'maint');
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--dry-run')) {
    log.error({ argv }, 'etl.maint: invalid args');
    log.info({ usage: usage() }, 'etl.maint: usage');
    await flushLogger(log);
    return 1;
  }

  const env = getEnv();
  const dbPath = getDuckDbPath(env);
  let conn: DuckDBConnection | undefined;
  let db: DuckDBInstance | undefined;

  try {
    db = await createDb(dbPath, { logger: log });
    conn = await db.connect();
    await assertMigrationsUpToDate(conn);

    const totals = await conn.runAndReadAll(
      `
      SELECT
        COUNT(*) AS total_runs,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs,
        COUNT(*) FILTER (WHERE status = 'published') AS published_runs
      FROM etl_runs;
      `,
    );

    const row = totals.getRowObjects()[0] ?? {};
    const totalRuns = Number(row['total_runs'] ?? 0);
    const failedRuns = Number(row['failed_runs'] ?? 0);
    const publishedRuns = Number(row['published_runs'] ?? 0);

    log.info(
      {
        mode: 'dry-run',
        dbPath,
        summary: {
          totalRuns,
          publishedRuns,
          failedRuns,
        },
        recommendedActions: [
          'Review failed etl_runs and root causes before maintenance actions.',
          'If many deletes happened recently, schedule a controlled DuckDB VACUUM window.',
          'Run maintenance only outside peak API traffic windows.',
        ],
      },
      'etl.maint: dry-run plan',
    );

    await flushLogger(log);
    return 0;
  } catch (err) {
    log.error({ err, dbPath }, 'etl.maint: failed');
    await flushLogger(log);
    return 1;
  } finally {
    try {
      conn?.closeSync();
    } catch {}
    try {
      db?.closeSync();
    } catch {}
  }
}

async function main() {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}

if (isDirectCliEntry(import.meta.url)) {
  void main();
}
