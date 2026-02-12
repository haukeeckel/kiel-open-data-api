import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../infra/db/duckdb.js';
import { withTestEnv } from '../test/helpers/env.js';

import { DISTRICTS_AGE_GROUPS } from './datasets/districts_age_groups.js';
import { DISTRICTS_AREA_HECTARES } from './datasets/districts_area_hectares.js';
import { DISTRICTS_GENDER } from './datasets/districts_gender.js';
import { DISTRICTS_HOUSEHOLDS_TYPE_SIZE } from './datasets/districts_households_type_size.js';
import { DISTRICTS_MARITAL_STATUS } from './datasets/districts_marital_status.js';
import { DISTRICTS_POPULATION } from './datasets/districts_population.js';
import { DISTRICTS_UNEMPLOYED_COUNT } from './datasets/districts_unemployed_count.js';
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

      const altstadt2022Reader = await conn.runAndReadAll(
        `
        SELECT value
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND area_name = ? AND year = ? AND category = ?;
        `,
        ['gender', 'district', 'Altstadt', 2022, 'total'],
      );
      expect(Number(altstadt2022Reader.getRowObjects()[0]?.['value'])).toBe(1213);
    } finally {
      conn.closeSync();
    }
  });

  it('imports age group categories including computed total', async () => {
    const ageGroupsCsv =
      [
        'Land;Stadt;Kategorie;Datum;Stadtteilnummer;Merkmal;Stadtteil;0 bis unter 3;3 bis unter 6;6 bis unter 10;10 bis unter 12;12 bis unter 15;15 bis unter 18;18 bis unter 21;21 bis unter 25;25 bis unter 30;30 bis unter 35;35 bis unter 40;40 bis unter 45;45 bis unter 50;50 bis unter 55;55 bis unter 60;60 bis unter 65;65 bis unter 70;70 bis unter 75;75 bis unter 80;80 und aelter',
        'de-sh;Kiel;Bevoelkerung;2022_12_31;1;Einwohner nach Altersgruppen;Altstadt;18;13;12;7;2;9;35;130;150;135;82;70;48;52;60;53;42;46;47;140',
        'de-sh;Kiel;Bevoelkerung;2023_12_31;1;Einwohner nach Altersgruppen;Altstadt;19;14;14;8;1;10;39;143;158;141;85;74;49;54;63;55;43;48;49;153',
        'de-sh;Kiel;Bevoelkerung;2022_12_31;2;Einwohner nach Altersgruppen;Vorstadt;31;33;28;7;16;13;44;154;298;231;90;74;72;67;81;63;57;47;62;111',
        'de-sh;Kiel;Bevoelkerung;2023_12_31;2;Einwohner nach Altersgruppen;Vorstadt;33;35;30;7;18;14;46;162;309;239;94;77;74;70;84;66;60;49;66;115',
      ].join('\n') + '\n';

    const ageGroupsCsvPath = path.join(cacheDir, DISTRICTS_AGE_GROUPS.csvFilename);
    await fs.writeFile(ageGroupsCsvPath, ageGroupsCsv, 'utf8');

    const first = await importDataset(DISTRICTS_AGE_GROUPS, { csvPath: ageGroupsCsvPath, dbPath });
    const second = await importDataset(DISTRICTS_AGE_GROUPS, { csvPath: ageGroupsCsvPath, dbPath });

    expect(first.imported).toBe(84);
    expect(second.imported).toBe(84);

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
        ['age_groups', 'district'],
      );
      const categories = categoriesReader.getRowObjects().map((r) => String(r['category']));
      expect(categories).toEqual([
        'age_0_2',
        'age_10_11',
        'age_12_14',
        'age_15_17',
        'age_18_20',
        'age_21_24',
        'age_25_29',
        'age_30_34',
        'age_35_39',
        'age_3_5',
        'age_40_44',
        'age_45_49',
        'age_50_54',
        'age_55_59',
        'age_60_64',
        'age_65_69',
        'age_6_9',
        'age_70_74',
        'age_75_79',
        'age_80_plus',
        'total',
      ]);

      const yearsReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT year
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND category = ?
        ORDER BY year ASC;
        `,
        ['age_groups', 'district', 'total'],
      );
      const years = yearsReader.getRowObjects().map((r) => Number(r['year']));
      expect(years).toEqual([2022, 2023]);

      const totalReader = await conn.runAndReadAll(
        `
        SELECT value
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND area_name = ? AND year = ? AND category = ?;
        `,
        ['age_groups', 'district', 'Altstadt', 2023, 'total'],
      );
      expect(Number(totalReader.getRowObjects()[0]?.['value'])).toBe(1220);
    } finally {
      conn.closeSync();
    }
  });

  it('imports area hectares with decimal comma parsing', async () => {
    const areaCsv =
      [
        'Land;Stadt;Kategorie;Merkmal;Jahr;Stadtteilnummer;Stadtteil;Hektar',
        'de-sh;Kiel;geo;Flaechen in Hektar;2019;1;Altstadt;35,0987',
        'de-sh;Kiel;geo;Flaechen in Hektar;2020;1;Altstadt;35,0987',
        'de-sh;Kiel;geo;Flaechen in Hektar;2019;2;Vorstadt;45,8515',
        'de-sh;Kiel;geo;Flaechen in Hektar;2020;2;Vorstadt;45,8515',
      ].join('\n') + '\n';

    const areaCsvPath = path.join(cacheDir, DISTRICTS_AREA_HECTARES.csvFilename);
    await fs.writeFile(areaCsvPath, areaCsv, 'utf8');

    const first = await importDataset(DISTRICTS_AREA_HECTARES, { csvPath: areaCsvPath, dbPath });
    const second = await importDataset(DISTRICTS_AREA_HECTARES, { csvPath: areaCsvPath, dbPath });

    expect(first.imported).toBe(4);
    expect(second.imported).toBe(4);

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
        ['area_hectares', 'district'],
      );
      const categories = categoriesReader.getRowObjects().map((r) => String(r['category']));
      expect(categories).toEqual(['total']);

      const yearsReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT year
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND category = ?
        ORDER BY year ASC;
        `,
        ['area_hectares', 'district', 'total'],
      );
      const years = yearsReader.getRowObjects().map((r) => Number(r['year']));
      expect(years).toEqual([2019, 2020]);

      const valueReader = await conn.runAndReadAll(
        `
        SELECT value
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND area_name = ? AND year = ? AND category = ?;
        `,
        ['area_hectares', 'district', 'Altstadt', 2020, 'total'],
      );
      expect(Number(valueReader.getRowObjects()[0]?.['value'])).toBeCloseTo(35.0987, 6);
    } finally {
      conn.closeSync();
    }
  });

  it('imports unemployed counts from date-like year columns', async () => {
    const unemployedCsv =
      [
        'Land;Stadt;Kategorie;Merkmal;Stadtteilnummer;Stadtteil;31.12.2023;31.12.2022',
        'de-sh;Kiel;wirtschaft_arbeit;Arbeitslose;1;Altstadt;16;14',
        'de-sh;Kiel;wirtschaft_arbeit;Arbeitslose;2;Vorstadt;43;43',
      ].join('\n') + '\n';

    const unemployedCsvPath = path.join(cacheDir, DISTRICTS_UNEMPLOYED_COUNT.csvFilename);
    await fs.writeFile(unemployedCsvPath, unemployedCsv, 'utf8');

    const first = await importDataset(DISTRICTS_UNEMPLOYED_COUNT, {
      csvPath: unemployedCsvPath,
      dbPath,
    });
    const second = await importDataset(DISTRICTS_UNEMPLOYED_COUNT, {
      csvPath: unemployedCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(4);
    expect(second.imported).toBe(4);

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
        ['unemployed_count', 'district'],
      );
      const categories = categoriesReader.getRowObjects().map((r) => String(r['category']));
      expect(categories).toEqual(['total']);

      const yearsReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT year
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND category = ?
        ORDER BY year ASC;
        `,
        ['unemployed_count', 'district', 'total'],
      );
      const years = yearsReader.getRowObjects().map((r) => Number(r['year']));
      expect(years).toEqual([2022, 2023]);

      const valueReader = await conn.runAndReadAll(
        `
        SELECT value
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND area_name = ? AND year = ? AND category = ?;
        `,
        ['unemployed_count', 'district', 'Altstadt', 2023, 'total'],
      );
      expect(Number(valueReader.getRowObjects()[0]?.['value'])).toBe(16);
    } finally {
      conn.closeSync();
    }
  });
});
