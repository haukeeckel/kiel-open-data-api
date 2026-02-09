import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { getEnv } from '../../config/env';
import { getDuckDbPath } from '../../config/path';

let instance: DuckDBInstance | null = null;

export async function getDb(): Promise<DuckDBInstance> {
  if (instance) return instance;

  const env = getEnv();
  const dbPath = getDuckDbPath(env);

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  instance = await DuckDBInstance.create(dbPath);
  return instance;
}

// only for tests
export function resetDbForTests() {
  instance = null;
}
