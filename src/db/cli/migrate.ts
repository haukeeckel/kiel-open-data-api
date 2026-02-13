import { pathToFileURL } from 'node:url';

import { getEnv } from '../../config/env.js';
import { getDuckDbPath } from '../../config/path.js';
import { createDb } from '../../infra/db/duckdb.js';
import { applyMigrations } from '../../infra/db/migrations.js';
import { createEtlLogger } from '../../logger/etl.js';
import { flushLogger } from '../../logger/flush.js';

import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

export async function runCli(): Promise<number> {
  const env = getEnv();
  const dbPath = getDuckDbPath(env);
  const log = createEtlLogger(env.NODE_ENV);

  let conn: DuckDBConnection | undefined;
  let db: DuckDBInstance | undefined;

  try {
    log.info({ dbPath }, 'db.migrate: start');
    db = await createDb(dbPath, { logger: log });
    conn = await db.connect();
    await applyMigrations(conn);
    log.info({ dbPath }, 'db.migrate: done');
    return 0;
  } catch (err) {
    log.error({ err, dbPath }, 'db.migrate: failed');
    return 1;
  } finally {
    try {
      conn?.closeSync();
    } catch {}
    try {
      db?.closeSync();
    } catch {}
    await flushLogger(log);
  }
}

function isDirectCliEntry(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return importMetaUrl === pathToFileURL(entry).href;
}

async function main() {
  const exitCode = await runCli();
  process.exit(exitCode);
}

if (isDirectCliEntry(import.meta.url)) {
  void main();
}
