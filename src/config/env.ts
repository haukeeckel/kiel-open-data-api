import 'dotenv/config';
import { z } from 'zod';
import { DEFAULT_HOST, DEFAULT_NODE_ENV, DEFAULT_PORT, NODE_ENVS } from './constants.js';

const EnvSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default(DEFAULT_NODE_ENV),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  HOST: z.string().default(DEFAULT_HOST),
  DUCKDB_PATH: z.string().trim().optional(),
  CORS_ORIGIN: z.string().default('*'),
  APP_VERSION: z.string().default(process.env['npm_package_version'] ?? '0.0.0'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  SWAGGER_ROUTE_PREFIX: z.string().default('/docs'),
});

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  cachedEnv = EnvSchema.parse(process.env);
  return cachedEnv;
}

// only for tests
export function resetEnvForTests() {
  cachedEnv = null;
}
