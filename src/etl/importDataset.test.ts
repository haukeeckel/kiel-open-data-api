import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../infra/db/duckdb.js';
import { withTestEnv } from '../test/helpers/env.js';

import { DISTRICTS_GENDER } from './datasets/districts_gender.js';
import { DISTRICTS_HOUSEHOLDS_TYPE_SIZE } from './datasets/districts_households_type_size.js';
import { DISTRICTS_MARITAL_STATUS } from './datasets/districts_marital_status.js';
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

  it('imports marital status categories including computed total', async () => {
    const maritalStatusCsv =
      [
        'Land;Stadt;Kategorie;Stadtteil;Jahr;ledig;verheiratet;verwitwet;geschieden',
        'de-sh;Kiel;Bevoelkerung;Altstadt;31_12_2022;690;332;90;83',
        'de-sh;Kiel;Bevoelkerung;Altstadt;31_12_2023;702;339;94;85',
        'de-sh;Kiel;Bevoelkerung;Vorstadt;31_12_2022;1014;365;97;127',
        'de-sh;Kiel;Bevoelkerung;Vorstadt;31_12_2023;1038;377;102;131',
      ].join('\n') + '\n';

    const maritalCsvPath = path.join(cacheDir, DISTRICTS_MARITAL_STATUS.csvFilename);
    await fs.writeFile(maritalCsvPath, maritalStatusCsv, 'utf8');

    const first = await importDataset(DISTRICTS_MARITAL_STATUS, {
      csvPath: maritalCsvPath,
      dbPath,
    });
    const second = await importDataset(DISTRICTS_MARITAL_STATUS, {
      csvPath: maritalCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(20);
    expect(second.imported).toBe(20);

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
        ['marital_status', 'district'],
      );
      const categories = categoriesReader.getRowObjects().map((r) => String(r['category']));
      expect(categories).toEqual(['divorced', 'married', 'single', 'total', 'widowed']);

      const totalRowsReader = await conn.runAndReadAll(
        `SELECT COUNT(*) AS c FROM statistics WHERE indicator = ? AND area_type = ? AND category = ?;`,
        ['marital_status', 'district', 'total'],
      );
      expect(Number(totalRowsReader.getRowObjects()[0]?.['c'])).toBe(4);
    } finally {
      conn.closeSync();
    }
  });

  it('imports gender categories and parses year from Datum', async () => {
    const genderCsv =
      [
        'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2022_12_31;1;Altstadt;1213;631;582',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;1;Altstadt;1220;638;582',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2022_12_31;2;Vorstadt;1600;800;800',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;2;Vorstadt;1648;829;819',
        'de-sh;Kiel;Bevoelkerung;Nicht relevant;2023_12_31;2;Vorstadt;9999;1;1',
      ].join('\n') + '\n';

    const genderCsvPath = path.join(cacheDir, DISTRICTS_GENDER.csvFilename);
    await fs.writeFile(genderCsvPath, genderCsv, 'utf8');

    const first = await importDataset(DISTRICTS_GENDER, { csvPath: genderCsvPath, dbPath });
    const second = await importDataset(DISTRICTS_GENDER, { csvPath: genderCsvPath, dbPath });

    expect(first.imported).toBe(12);
    expect(second.imported).toBe(12);

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
        ['gender', 'district'],
      );
      const categories = categoriesReader.getRowObjects().map((r) => String(r['category']));
      expect(categories).toEqual(['female', 'male', 'total']);

      const totalYearsReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT year
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND category = ?
        ORDER BY year ASC;
        `,
        ['gender', 'district', 'total'],
      );
      const years = totalYearsReader.getRowObjects().map((r) => Number(r['year']));
      expect(years).toEqual([2022, 2023]);
    } finally {
      conn.closeSync();
    }
  });
});
