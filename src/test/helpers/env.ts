import { type Env, resetEnvForTests } from '../../config/env.js';

type TestEnv = Partial<
  Pick<
    Env,
    | 'NODE_ENV'
    | 'PORT'
    | 'HOST'
    | 'DUCKDB_PATH'
    | 'CORS_ORIGIN'
    | 'APP_VERSION'
    | 'RATE_LIMIT_MAX'
    | 'RATE_LIMIT_WINDOW_MS'
    | 'DB_QUERY_TIMEOUT_MS'
    | 'SWAGGER_ROUTE_PREFIX'
    | 'SWAGGER_UI_ENABLED'
  >
>;

type TestEnvWithUnset = {
  [K in keyof TestEnv]: TestEnv[K] | undefined;
};

function applyEnv(next: TestEnvWithUnset) {
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }
}

export function setTestEnv(next: TestEnvWithUnset) {
  applyEnv(next);
  resetEnvForTests();
}

export function resetTestEnvToDefaults() {
  setTestEnv({ NODE_ENV: 'test', DUCKDB_PATH: ':memory:' });
}

export function withTestEnv(next: TestEnvWithUnset) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(next)) {
    previous[key] = process.env[key];
  }

  setTestEnv(next);

  return () => {
    for (const key of Object.keys(next)) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    resetEnvForTests();
  };
}
