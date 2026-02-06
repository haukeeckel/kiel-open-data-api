import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'kiel.duckdb');

let instance: DuckDBInstance | null = null;

export async function getDb(): Promise<DuckDBInstance> {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  instance = await DuckDBInstance.create(DB_PATH);

  return instance;
}
