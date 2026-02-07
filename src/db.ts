import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'node:fs';
import * as path from 'node:path';

let instance: DuckDBInstance | null = null;

export async function getDb(): Promise<DuckDBInstance> {
  if (instance) return instance;

  const dbPath = process.env.DUCKDB_PATH ?? path.join(process.cwd(), 'data', 'kiel.duckdb');

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  instance = await DuckDBInstance.create(dbPath);
  return instance;
}
