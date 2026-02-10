import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { importDistrictsPopulation } from './import_districts_population';
import { createDb } from '../infra/db/duckdb';
import { CSV_FILENAME } from './districts_population.constants';

function mkTmpDir() {
  return fssync.mkdtempSync(path.join(os.tmpdir(), 'kiel-etl-'));
}

describe('importDistrictsPopulation', () => {
  let tmp: string;
  let cacheDir: string;
  let csvPath: string;
  let dbPath: string;

  beforeEach(async () => {
    tmp = mkTmpDir();
    cacheDir = path.join(tmp, 'data', 'cache');
    csvPath = path.join(cacheDir, CSV_FILENAME);
    dbPath = path.join(cacheDir, 'test.duckdb');

    await fs.mkdir(cacheDir, { recursive: true });

    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    try {
      fssync.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  it('imports districts population into statistics table', async () => {
    const csv =
      [
        'Merkmal;Stadtteil;2022;2023',
        'Einwohner insgesamt;Altstadt;1213;1220',
        'Einwohner insgesamt;Gaarden-Ost;17900;18000',
        'Irgendwas anderes;Altstadt;1;2',
      ].join('\n') + '\n';

    await fs.writeFile(csvPath, csv, 'utf8');

    const res = await importDistrictsPopulation({ csvPath, dbPath });

    expect(res.csvPath).toBe(csvPath);
    expect(res.dbPath).toBe(dbPath);
    expect(res.imported).toBe(4);

    const db = await createDb(dbPath);
    const conn = await db.connect();
    try {
      const reader = await conn.runAndReadAll(
        `SELECT COUNT(*) AS c FROM statistics WHERE indicator = ? AND area_type = ?;`,
        ['population', 'district'],
      );
      expect(Number(reader.getRowObjects()[0]?.c)).toBe(4);
    } finally {
      conn.closeSync();
    }
  });

  it('throws when no year columns exist', async () => {
    const csv =
      ['Merkmal;Stadtteil;foo;bar', 'Einwohner insgesamt;Altstadt;1213;1220'].join('\n') + '\n';

    await fs.writeFile(csvPath, csv, 'utf8');

    await expect(importDistrictsPopulation({ csvPath, dbPath })).rejects.toThrow(
      /No year columns found/i,
    );
  });
});
