import { createDb } from './duckdb.js';

import type { DbLogger } from './logger.js';
import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

const DEFAULT_POOL_SIZE = 4;

type LoggerLike = DbLogger;

export type DuckDbConnectionManager = {
  withConnection<T>(fn: (conn: DuckDBConnection) => Promise<T>): Promise<T>;
  healthcheck(): Promise<boolean>;
  close(): Promise<void>;
};

type CreateDuckDbConnectionManagerOptions = {
  dbPath: string;
  poolSize?: number;
  logger?: LoggerLike;
};

type State = {
  db: DuckDBInstance;
  connections: DuckDBConnection[];
};

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

async function ping(conn: DuckDBConnection): Promise<void> {
  await conn.run('SELECT 1');
}

export function createDuckDbConnectionManager(
  options: CreateDuckDbConnectionManagerOptions,
): DuckDbConnectionManager {
  const poolSize = Math.max(1, options.poolSize ?? DEFAULT_POOL_SIZE);
  const logger = options.logger;

  let state: State | null = null;
  let roundRobin = 0;
  let reconnectInFlight: Promise<void> | null = null;

  const init = async (): Promise<State> => {
    const db = await createDb(options.dbPath, logger !== undefined ? { logger } : undefined);
    const connections: DuckDBConnection[] = [];
    for (let i = 0; i < poolSize; i += 1) {
      connections.push(await db.connect());
    }
    return { db, connections };
  };

  const ensureState = async (): Promise<State> => {
    if (!state) {
      state = await init();
    }
    return state;
  };

  const closeState = (current: State | null): void => {
    if (!current) return;
    for (const conn of current.connections) {
      try {
        conn.closeSync();
      } catch {}
    }
    try {
      current.db.closeSync();
    } catch {}
  };

  const reconnect = async (reason: unknown): Promise<void> => {
    if (!reconnectInFlight) {
      reconnectInFlight = (async () => {
        const prev = state;
        state = null;
        roundRobin = 0;
        closeState(prev);
        logger?.warn?.({ err: toError(reason) }, 'duckdb manager: reconnecting');
        state = await init();
      })().finally(() => {
        reconnectInFlight = null;
      });
    }
    await reconnectInFlight;
  };

  const selectConnection = (current: State): DuckDBConnection => {
    const index = roundRobin % current.connections.length;
    roundRobin += 1;
    return current.connections[index] as DuckDBConnection;
  };

  return {
    async withConnection<T>(fn: (conn: DuckDBConnection) => Promise<T>): Promise<T> {
      const current = await ensureState();
      const conn = selectConnection(current);

      try {
        return await fn(conn);
      } catch (firstErr) {
        let isConnectionHealthy = true;
        try {
          await ping(conn);
        } catch {
          isConnectionHealthy = false;
        }

        if (isConnectionHealthy) throw firstErr;

        await reconnect(firstErr);
        const recovered = await ensureState();
        const retryConn = selectConnection(recovered);
        return await fn(retryConn);
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
      if (reconnectInFlight) {
        await reconnectInFlight;
      }
      const current = state;
      state = null;
      closeState(current);
    },
  };
}
