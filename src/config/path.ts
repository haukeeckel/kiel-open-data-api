import * as path from 'node:path';
import type { Env } from './env';

export function getCacheDir() {
  return path.join(process.cwd(), 'data', 'cache');
}

export function getDataDir() {
  return path.join(process.cwd(), 'data');
}

export function getDuckDbPath(env: Env) {
  if (env.DUCKDB_PATH) {
    const raw = env.DUCKDB_PATH;
    const absolute = path.isAbsolute(raw) ? raw : path.join(getDataDir(), raw);
    return path.resolve(absolute);
  }

  const fileName = env.NODE_ENV === 'production' ? 'kiel.duckdb' : `kiel.${env.NODE_ENV}.duckdb`;
  return path.resolve(path.join(getDataDir(), fileName));
}
