import * as path from 'node:path';
import type { Env } from './env';

export function getCacheDir() {
  return path.join(process.cwd(), 'data', 'cache');
}

export function getDataDir() {
  return path.join(process.cwd(), 'data');
}

// TODO: später: db path by env, DUCKDB_PATH override, etc.
export function getDuckDbPath(env: Env) {
  if (env.DUCKDB_PATH) {
    return path.isAbsolute(env.DUCKDB_PATH)
      ? env.DUCKDB_PATH
      : path.join(getDataDir(), env.DUCKDB_PATH);
  }

  const fileName = env.NODE_ENV === 'production' ? 'kiel.duckdb' : `kiel.${env.NODE_ENV}.duckdb`;
  return path.join(getDataDir(), fileName);
}
