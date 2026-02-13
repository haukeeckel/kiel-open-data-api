import * as fs from 'node:fs';
import * as path from 'node:path';

import { DuckDBInstance } from '@duckdb/node-api';

import { DEFAULT_RETRIES, type RetryConfig } from '../../config/retry.js';
import { sleep } from '../../utils/sleep.js';

import type { DbLogger } from './logger.js';

type LoggerLike = DbLogger;

type CreateDbOptions = Partial<RetryConfig> & {
  logger?: LoggerLike;
};

function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  if (typeof err === 'string') {
    return new Error(err);
  }
  return new Error('Unknown error');
}

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

  throw toError(lastError);
}
