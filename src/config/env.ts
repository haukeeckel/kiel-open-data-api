import dotenv from 'dotenv';
import { z } from 'zod';

import { DEFAULT_HOST, DEFAULT_NODE_ENV, DEFAULT_PORT, NODE_ENVS } from './constants.js';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default(DEFAULT_NODE_ENV),
    PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
    HOST: z.string().default(DEFAULT_HOST),
    DUCKDB_PATH: z.string().trim().optional(),
    CORS_ORIGIN: z.string().trim().optional(),
    APP_VERSION: z.string().default(process.env['npm_package_version'] ?? '0.0.0'),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    DB_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),
    DB_POOL_SIZE: z.coerce.number().int().min(1).max(64).default(4),
    DB_POOL_ACQUIRE_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),
    METRICS_ENABLED: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(['true', 'false']))
      .optional(),
    METRICS_TOKEN: z.string().trim().optional(),
    METRICS_AUTH_HEADER: z.string().trim().default('x-metrics-token'),
    OBS_SLOW_QUERY_THRESHOLD_MS: z.coerce.number().int().positive().default(500),
    OBS_PLAN_SAMPLE_ENABLED: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(['true', 'false']))
      .optional(),
    SWAGGER_ROUTE_PREFIX: z.string().default('/docs'),
    SWAGGER_UI_ENABLED: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(['true', 'false']))
      .optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !!env.CORS_ORIGIN, {
    message: 'CORS_ORIGIN must be set in production',
    path: ['CORS_ORIGIN'],
  })
  .transform((env) => ({
    ...env,
    CORS_ORIGIN: env.CORS_ORIGIN || (env.NODE_ENV === 'production' ? '' : '*'),
    SWAGGER_UI_ENABLED:
      env.SWAGGER_UI_ENABLED !== undefined
        ? env.SWAGGER_UI_ENABLED.toLowerCase() === 'true'
        : env.NODE_ENV !== 'production',
    METRICS_ENABLED:
      env.METRICS_ENABLED !== undefined
        ? env.METRICS_ENABLED.toLowerCase() === 'true'
        : env.NODE_ENV !== 'production',
    METRICS_TOKEN: env.METRICS_TOKEN || undefined,
    OBS_PLAN_SAMPLE_ENABLED:
      env.OBS_PLAN_SAMPLE_ENABLED !== undefined
        ? env.OBS_PLAN_SAMPLE_ENABLED.toLowerCase() === 'true'
        : false,
  }));

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const isTestRuntime = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
  if (!isTestRuntime) {
    dotenv.config();
  }
  cachedEnv = EnvSchema.parse(process.env);
  return cachedEnv;
}

// only for tests
export function resetEnvForTests() {
  cachedEnv = null;
}
