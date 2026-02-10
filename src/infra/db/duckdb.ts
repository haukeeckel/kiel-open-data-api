import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sleep } from '../../utils/sleep.js';

type LoggerLike = {
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
};

type CreateDbOptions = {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  logger?: LoggerLike;
};

const defaultOptions: Required<Omit<CreateDbOptions, 'logger'>> = {
  // retries = number of retries after the first attempt (matches fetchWithRetry semantics)
  retries: 3,
  baseDelayMs: 100,
  maxDelayMs: 1000,
};

export async function createDb(dbPath: string, options?: CreateDbOptions): Promise<DuckDBInstance> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const { retries, baseDelayMs, maxDelayMs } = { ...defaultOptions, ...options };
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
