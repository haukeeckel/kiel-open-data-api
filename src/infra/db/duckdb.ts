import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'node:fs';
import * as path from 'node:path';

export async function createDb(dbPath: string): Promise<DuckDBInstance> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return DuckDBInstance.create(dbPath);
}
