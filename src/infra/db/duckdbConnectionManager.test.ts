import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createDuckDbConnectionManager } from './duckdbConnectionManager.js';

import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

const { createDbMock } = vi.hoisted(() => ({ createDbMock: vi.fn() }));

vi.mock('./duckdb.js', () => ({
  createDb: createDbMock,
}));

type MockConn = {
  id: string;
  run: ReturnType<typeof vi.fn>;
  closeSync: ReturnType<typeof vi.fn>;
};

type MockDb = {
  connect: ReturnType<typeof vi.fn>;
  closeSync: ReturnType<typeof vi.fn>;
};

function makeConn(id: string): MockConn {
  return {
    id,
    run: vi.fn(async () => undefined),
    closeSync: vi.fn(),
  };
}

function makeDb(conns: MockConn[]): MockDb {
  let index = 0;
  return {
    connect: vi.fn(async () => {
      const conn = conns[index];
      index += 1;
      if (!conn) throw new Error('no mock connection left');
      return conn as unknown as DuckDBConnection;
    }),
    closeSync: vi.fn(),
  };
}

describe('duckdbConnectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pool and leases distinct connections while both are busy', async () => {
    const db = makeDb([makeConn('c1'), makeConn('c2')]);
    createDbMock.mockResolvedValue(db as unknown as DuckDBInstance);

    const manager = createDuckDbConnectionManager({ dbPath: '/tmp/test.duckdb', poolSize: 2 });

    const seen: string[] = [];
    await Promise.all([
      manager.withConnection(async (conn) => {
        seen.push((conn as unknown as MockConn).id);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }),
      manager.withConnection(async (conn) => {
        seen.push((conn as unknown as MockConn).id);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }),
    ]);

    expect(new Set(seen)).toEqual(new Set(['c1', 'c2']));
    expect(createDbMock).toHaveBeenCalledTimes(1);
    expect(db.connect).toHaveBeenCalledTimes(2);

    await manager.close();
    expect(db.closeSync).toHaveBeenCalledTimes(1);
  });

  it('propagates query errors and keeps manager usable', async () => {
    const connA = makeConn('a');
    const connB = makeConn('b');
    const db = makeDb([connA, connB]);
    createDbMock.mockResolvedValue(db as unknown as DuckDBInstance);

    const manager = createDuckDbConnectionManager({ dbPath: '/tmp/test.duckdb', poolSize: 2 });

    await expect(
      manager.withConnection(async () => {
        throw new Error('invalid sql');
      }),
    ).rejects.toThrow(/invalid sql/i);

    expect(createDbMock).toHaveBeenCalledTimes(1);

    await expect(
      manager.withConnection(async (conn) => (conn as unknown as MockConn).id),
    ).resolves.toMatch(/a|b/);

    await manager.close();
  });

  it('healthcheck returns false when selected connection is broken', async () => {
    const broken = makeConn('broken');
    broken.run.mockRejectedValue(new Error('connection closed'));

    const db = makeDb([broken]);
    createDbMock.mockResolvedValueOnce(db as unknown as DuckDBInstance);

    const manager = createDuckDbConnectionManager({ dbPath: '/tmp/test.duckdb', poolSize: 1 });

    await expect(manager.healthcheck()).resolves.toBe(false);
    await manager.close();
  });

  it('serializes concurrent init and creates state once', async () => {
    const db = makeDb([makeConn('c1')]);
    createDbMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return db as unknown as DuckDBInstance;
    });

    const manager = createDuckDbConnectionManager({ dbPath: '/tmp/test.duckdb', poolSize: 1 });

    await Promise.all([
      manager.withConnection(async () => undefined),
      manager.withConnection(async () => undefined),
    ]);

    expect(createDbMock).toHaveBeenCalledTimes(1);
    await manager.close();
  });

  it('times out when waiting for a free lease too long', async () => {
    const db = makeDb([makeConn('c1')]);
    createDbMock.mockResolvedValue(db as unknown as DuckDBInstance);
    const manager = createDuckDbConnectionManager({
      dbPath: '/tmp/test.duckdb',
      poolSize: 1,
      acquireTimeoutMs: 10,
    });

    const blocker = manager.withConnection(
      async () => await new Promise((resolve) => setTimeout(resolve, 50)),
    );

    await expect(manager.withConnection(async () => undefined)).rejects.toThrow(
      /waiting for a DB connection lease/i,
    );
    await blocker;
    await manager.close();
  });
});
