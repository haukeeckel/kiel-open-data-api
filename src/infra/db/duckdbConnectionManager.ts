import { createDb } from './duckdb.js';

import type { DbLogger } from './logger.js';
import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

const DEFAULT_POOL_SIZE = 4;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 2_000;

type LoggerLike = DbLogger;

export type DuckDbConnectionManager = {
  withConnection<T>(fn: (conn: DuckDBConnection) => Promise<T>): Promise<T>;
  healthcheck(): Promise<boolean>;
  close(): Promise<void>;
};

type CreateDuckDbConnectionManagerOptions = {
  dbPath: string;
  poolSize?: number;
  acquireTimeoutMs?: number;
  logger?: LoggerLike;
};

type State = {
  db: DuckDBInstance;
  connections: Array<{
    conn: DuckDBConnection;
    leased: boolean;
  }>;
};

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

async function ping(conn: DuckDBConnection): Promise<void> {
  await conn.run('SELECT 1');
}

class PoolAcquireTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Timed out while waiting for a DB connection lease after ${timeoutMs}ms`);
    this.name = 'PoolAcquireTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

class ConnectionManagerClosedError extends Error {
  constructor() {
    super('DuckDB connection manager is closed');
    this.name = 'ConnectionManagerClosedError';
  }
}

export function createDuckDbConnectionManager(
  options: CreateDuckDbConnectionManagerOptions,
): DuckDbConnectionManager {
  const poolSize = Math.max(1, options.poolSize ?? DEFAULT_POOL_SIZE);
  const acquireTimeoutMs = Math.max(1, options.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS);
  const logger = options.logger;

  let state: State | null = null;
  let initInFlight: Promise<State> | null = null;
  let isClosed = false;
  const waitQueue: Array<{
    resolve: (conn: DuckDBConnection) => void;
    reject: (err: unknown) => void;
    timer: NodeJS.Timeout;
    isSettled: boolean;
  }> = [];

  const init = async (): Promise<State> => {
    const db = await createDb(options.dbPath, logger !== undefined ? { logger } : undefined);
    const connections: State['connections'] = [];
    for (let i = 0; i < poolSize; i += 1) {
      connections.push({ conn: await db.connect(), leased: false });
    }
    return { db, connections };
  };

  const ensureState = async (): Promise<State> => {
    if (isClosed) {
      throw new ConnectionManagerClosedError();
    }
    if (state) return state;
    if (!initInFlight) {
      initInFlight = init()
        .then((nextState) => {
          state = nextState;
          return nextState;
        })
        .finally(() => {
          initInFlight = null;
        });
    }
    return await initInFlight;
  };

  const closeState = (current: State | null): void => {
    if (!current) return;
    for (const conn of current.connections) {
      try {
        conn.conn.closeSync();
      } catch {}
    }
    try {
      current.db.closeSync();
    } catch {}
  };

  const dequeueWaiter = (): (typeof waitQueue)[number] | undefined => {
    for (let i = 0; i < waitQueue.length; i += 1) {
      const waiter = waitQueue[i];
      if (!waiter) continue;
      waitQueue.splice(i, 1);
      if (waiter.isSettled) {
        i -= 1;
        continue;
      }
      return waiter;
    }
    return undefined;
  };

  const tryLease = (current: State): DuckDBConnection | null => {
    const free = current.connections.find((entry) => !entry.leased);
    if (!free) return null;
    free.leased = true;
    return free.conn;
  };

  const releaseLease = (leasedConn: DuckDBConnection): void => {
    if (!state) return;
    const entry = state.connections.find((item) => item.conn === leasedConn);
    if (!entry) return;
    entry.leased = false;

    const waiter = dequeueWaiter();
    if (!waiter) return;
    clearTimeout(waiter.timer);
    waiter.isSettled = true;

    const nextConn = tryLease(state);
    if (!nextConn) {
      waiter.reject(new Error('Lease queue resumed without available connection'));
      return;
    }
    waiter.resolve(nextConn);
  };

  const acquireLease = async (): Promise<DuckDBConnection> => {
    const current = await ensureState();
    const immediate = tryLease(current);
    if (immediate) return immediate;

    return await new Promise<DuckDBConnection>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          waiter.isSettled = true;
          reject(new PoolAcquireTimeoutError(acquireTimeoutMs));
        }, acquireTimeoutMs),
        isSettled: false,
      };
      waitQueue.push(waiter);
    });
  };

  return {
    async withConnection<T>(fn: (conn: DuckDBConnection) => Promise<T>): Promise<T> {
      const conn = await acquireLease();
      try {
        return await fn(conn);
      } catch (err) {
        logger?.warn?.({ err: toError(err) }, 'duckdb manager: query failed');
        throw err;
      } finally {
        releaseLease(conn);
      }
    },

    async healthcheck(): Promise<boolean> {
      try {
        await this.withConnection(async (conn) => {
          await ping(conn);
          return undefined;
        });
        return true;
      } catch (err) {
        logger?.warn?.({ err: toError(err) }, 'duckdb manager: healthcheck failed');
        return false;
      }
    },

    async close(): Promise<void> {
      isClosed = true;
      while (waitQueue.length > 0) {
        const waiter = waitQueue.shift();
        if (!waiter || waiter.isSettled) continue;
        clearTimeout(waiter.timer);
        waiter.isSettled = true;
        waiter.reject(new ConnectionManagerClosedError());
      }
      const current = state;
      state = null;
      closeState(current);
    },
  };
}
