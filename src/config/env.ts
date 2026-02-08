import 'dotenv/config';
import { z } from 'zod';
import { DEFAULT_HOST, DEFAULT_NODE_ENV, DEFAULT_PORT, NODE_ENVS } from './constants';

const EnvSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default(DEFAULT_NODE_ENV),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  HOST: z.string().default(DEFAULT_HOST),
  DUCKDB_PATH: z.string().trim().optional(),
});

export const env = EnvSchema.parse(process.env);
export type Env = typeof env;
