import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_RETRIES, type RetryConfig } from '../../config/retry.js';
import { sleep } from '../../utils/sleep.js';

type LoggerLike = {
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
};

type CreateDbOptions = Partial<RetryConfig> & {
  logger?: LoggerLike;
};

const defaults: RetryConfig = {
  retries: DEFAULT_RETRIES,
  baseDelayMs: 100,
  maxDelayMs: 1000,
};

export async function createDb(dbPath: string, options?: CreateDbOptions): Promise<DuckDBInstance> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const { retries, baseDelayMs, maxDelayMs } = { ...defaults, ...options };
  const logger = options?.logger;
  const startedAt = Date.now();

  logger?.info?.({ dbPath }, 'duckdb: create start');

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay);
    }

    try {
      const db = await DuckDBInstance.create(dbPath);
      logger?.info?.(
        { dbPath, attempts: attempt + 1, ms: Date.now() - startedAt },
        'duckdb: create success',
      );
      return db;
    } catch (err) {
      lastError = err;
      logger?.warn?.({ err, attempt: attempt + 1, dbPath }, 'duckdb: create failed');
      if (attempt === retries) {
        logger?.error?.(
          { err, attempts: attempt + 1, dbPath },
          'duckdb: create failed after retries',
        );
      }
    }
  }

  throw lastError;
}
