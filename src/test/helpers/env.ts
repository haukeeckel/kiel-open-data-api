import { resetEnvForTests } from '../../config/env';
import { resetDbForTests } from '../../infra/db/duckdb';

type TestEnv = {
  NODE_ENV?: 'test' | 'development' | 'production';
  DUCKDB_PATH?: string;
};

export function setTestEnv(next: TestEnv) {
  if (next.NODE_ENV !== undefined) process.env.NODE_ENV = next.NODE_ENV;
  if (next.DUCKDB_PATH !== undefined) process.env.DUCKDB_PATH = next.DUCKDB_PATH;

  // IMPORTANT: caches resetten, weil getEnv()/getDb() cachen
  resetEnvForTests();
  resetDbForTests();
}

export function resetTestEnvToDefaults() {
  process.env.NODE_ENV = 'test';
  process.env.DUCKDB_PATH = ':memory:';
  resetEnvForTests();
  resetDbForTests();
}
