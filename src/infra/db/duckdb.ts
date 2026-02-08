import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'node:fs';
import * as path from 'node:path';

let instance: DuckDBInstance | null = null;

function resolveDbPath() {
  if (process.env.DUCKDB_PATH) return path.resolve(process.env.DUCKDB_PATH);
  return path.join(process.cwd(), 'data', 'kiel.duckdb');
}

export async function getDb(): Promise<DuckDBInstance> {
  if (instance) return instance;

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  instance = await DuckDBInstance.create(dbPath);
  return instance;
}

// only for tests
export function resetDbForTests() {
  instance = null;
}
