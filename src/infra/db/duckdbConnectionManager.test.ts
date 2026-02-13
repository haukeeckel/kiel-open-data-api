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

  it('creates a pool and uses round-robin for operations', async () => {
    const db = makeDb([makeConn('c1'), makeConn('c2')]);
    createDbMock.mockResolvedValue(db as unknown as DuckDBInstance);

    const manager = createDuckDbConnectionManager({ dbPath: '/tmp/test.duckdb', poolSize: 2 });

    const seen: string[] = [];
    await manager.withConnection(async (conn) => {
      seen.push((conn as unknown as MockConn).id);
      return undefined;
    });
    await manager.withConnection(async (conn) => {
      seen.push((conn as unknown as MockConn).id);
      return undefined;
    });
    await manager.withConnection(async (conn) => {
      seen.push((conn as unknown as MockConn).id);
      return undefined;
    });

    expect(seen).toEqual(['c1', 'c2', 'c1']);
    expect(createDbMock).toHaveBeenCalledTimes(1);
    expect(db.connect).toHaveBeenCalledTimes(2);

    await manager.close();
    expect(db.closeSync).toHaveBeenCalledTimes(1);
  });

  it('reconnects and retries once when selected connection is broken', async () => {
    const broken = makeConn('broken');
    const oldOther = makeConn('old-other');
    const newA = makeConn('new-a');
    const newB = makeConn('new-b');

    broken.run.mockRejectedValue(new Error('connection closed'));

    const db1 = makeDb([broken, oldOther]);
    const db2 = makeDb([newA, newB]);
    createDbMock
      .mockResolvedValueOnce(db1 as unknown as DuckDBInstance)
      .mockResolvedValueOnce(db2 as unknown as DuckDBInstance);

    const manager = createDuckDbConnectionManager({ dbPath: '/tmp/test.duckdb', poolSize: 2 });

    const seen: string[] = [];
    const result = await manager.withConnection(async (conn) => {
      const id = (conn as unknown as MockConn).id;
      seen.push(id);
      if (id === 'broken') throw new Error('query failed on broken connection');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(seen).toEqual(['broken', 'new-a']);
    expect(createDbMock).toHaveBeenCalledTimes(2);
    expect(broken.closeSync).toHaveBeenCalledTimes(1);
    expect(oldOther.closeSync).toHaveBeenCalledTimes(1);
    expect(db1.closeSync).toHaveBeenCalledTimes(1);

    await manager.close();
  });

  it('does not reconnect on query errors when connection ping succeeds', async () => {
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

    await manager.close();
  });

  it('healthcheck returns false when reconnect cannot recover', async () => {
    const broken = makeConn('broken');
    broken.run.mockRejectedValue(new Error('connection closed'));

    const db = makeDb([broken]);
    createDbMock
      .mockResolvedValueOnce(db as unknown as DuckDBInstance)
      .mockRejectedValueOnce(new Error('db create failed'));

    const manager = createDuckDbConnectionManager({ dbPath: '/tmp/test.duckdb', poolSize: 1 });

    await expect(manager.healthcheck()).resolves.toBe(false);
    await manager.close();
  });
});
