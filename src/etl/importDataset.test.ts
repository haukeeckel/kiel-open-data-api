import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../infra/db/duckdb.js';
import { withTestEnv } from '../test/helpers/env.js';

import { DISTRICTS_HOUSEHOLDS_TYPE_SIZE } from './datasets/districts_households_type_size.js';
import { DISTRICTS_POPULATION } from './datasets/districts_population.js';
import { importDataset } from './importDataset.js';

function mkTmpDir() {
  return fssync.mkdtempSync(path.join(os.tmpdir(), 'kiel-etl-'));
}

describe('importDataset', () => {
  let tmp: string;
  let cacheDir: string;
  let csvPath: string;
  let dbPath: string;
  let restoreEnv: (() => void) | null = null;

  beforeEach(async () => {
    tmp = mkTmpDir();
    cacheDir = path.join(tmp, 'data', 'cache');
    csvPath = path.join(cacheDir, DISTRICTS_POPULATION.csvFilename);
    dbPath = path.join(cacheDir, 'test.duckdb');

    await fs.mkdir(cacheDir, { recursive: true });

    restoreEnv = withTestEnv({ NODE_ENV: 'test' });
  });

  afterEach(() => {
    restoreEnv?.();
    restoreEnv = null;
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

    const res = await importDataset(DISTRICTS_POPULATION, { csvPath, dbPath });

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
      expect(Number(reader.getRowObjects()[0]?.['c'])).toBe(4);
    } finally {
      conn.closeSync();
    }
  });

  it('throws when required columns are missing', async () => {
    const csv = ['Name;2022;2023', 'Altstadt;1213;1220'].join('\n') + '\n';

    await fs.writeFile(csvPath, csv, 'utf8');

    await expect(importDataset(DISTRICTS_POPULATION, { csvPath, dbPath })).rejects.toThrow(
      /Missing required columns.*Merkmal.*Stadtteil/i,
    );
  });

  it('throws when CSV file does not exist', async () => {
    const missing = path.join(cacheDir, 'nonexistent.csv');

    await expect(importDataset(DISTRICTS_POPULATION, { csvPath: missing, dbPath })).rejects.toThrow(
      /CSV file not found/i,
    );
  });

  it('throws when no year columns exist', async () => {
    const csv =
      ['Merkmal;Stadtteil;foo;bar', 'Einwohner insgesamt;Altstadt;1213;1220'].join('\n') + '\n';

    await fs.writeFile(csvPath, csv, 'utf8');

    await expect(importDataset(DISTRICTS_POPULATION, { csvPath, dbPath })).rejects.toThrow(
      /No year columns found/i,
    );
  });

  it('imports multiple household categories and can reimport deterministically', async () => {
    const householdsCsv =
      [
        'Land;Stadt;Kategorie;Jahr;Stadtteile;Merkmal;Einpersonen;Paar ohne Kind;Paar mit Kindern;Paar mit Nachkommen;Alleinerziehende;Sonst. Mehrpersonenhaushalte',
        'de-sh;Kiel;Bevoelkerung;31.12.2022;Altstadt;Haushalte;500;180;32;7;11;30',
        'de-sh;Kiel;Bevoelkerung;31.12.2023;Altstadt;Haushalte;505;181;31;8;12;31',
        'de-sh;Kiel;Bevoelkerung;31.12.2022;Gaarden-Ost;Haushalte;3200;1500;720;165;170;280',
        'de-sh;Kiel;Bevoelkerung;31.12.2023;Gaarden-Ost;Haushalte;3220;1510;730;170;183;290',
      ].join('\n') + '\n';

    await fs.writeFile(csvPath, householdsCsv, 'utf8');

    const first = await importDataset(DISTRICTS_HOUSEHOLDS_TYPE_SIZE, { csvPath, dbPath });
    const second = await importDataset(DISTRICTS_HOUSEHOLDS_TYPE_SIZE, { csvPath, dbPath });

    expect(first.imported).toBe(28);
    expect(second.imported).toBe(28);

    const db = await createDb(dbPath);
    const conn = await db.connect();
    try {
      const categoriesReader = await conn.runAndReadAll(
        `
        SELECT category
        FROM statistics
        WHERE indicator = ? AND area_type = ?
        GROUP BY category
        ORDER BY category ASC;
        `,
        ['households', 'district'],
      );
      const categories = categoriesReader.getRowObjects().map((r) => String(r['category']));
      expect(categories).toEqual([
        'couple_no_children',
        'couple_with_children',
        'couple_with_descendants',
        'other_multi_person',
        'single_parent',
        'single_person',
        'total',
      ]);

      const totalRowsReader = await conn.runAndReadAll(
        `SELECT COUNT(*) AS c FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
        ['households', 'district', 'total'],
      );
      expect(Number(totalRowsReader.getRowObjects()[0]?.['c'])).toBe(4);
    } finally {
      conn.closeSync();
    }
  });
});
