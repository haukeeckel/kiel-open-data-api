import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../infra/db/duckdb.js';
import { withTestEnv } from '../test/helpers/env.js';

import { DISTRICTS_AGE_GROUPS } from './datasets/districts_age_groups.js';
import { DISTRICTS_AREA_HECTARES } from './datasets/districts_area_hectares.js';
import { DISTRICTS_FOREIGN_AGE_GROUPS } from './datasets/districts_foreign_age_groups.js';
import { DISTRICTS_FOREIGN_COUNT } from './datasets/districts_foreign_count.js';
import { DISTRICTS_FOREIGN_GENDER } from './datasets/districts_foreign_gender.js';
import { DISTRICTS_FOREIGN_NATIONALITIES_SELECTED } from './datasets/districts_foreign_nationalities_selected.js';
import { DISTRICTS_GENDER } from './datasets/districts_gender.js';
import { DISTRICTS_HOUSEHOLDS_TYPE_SIZE } from './datasets/districts_households_type_size.js';
import { DISTRICTS_MARITAL_STATUS } from './datasets/districts_marital_status.js';
import { DISTRICTS_MIGRANT_GENDER } from './datasets/districts_migrant_gender.js';
import { DISTRICTS_POPULATION } from './datasets/districts_population.js';
import { DISTRICTS_RELIGION } from './datasets/districts_religion.js';
import { DISTRICTS_UNEMPLOYED_COUNT } from './datasets/districts_unemployed_count.js';
import { DISTRICTS_UNEMPLOYED_RATE } from './datasets/districts_unemployed_rate.js';
import { importDataset } from './importDataset.js';

import type { DuckDBConnection } from '@duckdb/node-api';

function mkTmpDir() {
  return fssync.mkdtempSync(path.join(os.tmpdir(), 'kiel-etl-'));
}

// ── Query helpers ──────────────────────────────────────────────────────────

async function withConn(
  dbPath: string,
  fn: (conn: DuckDBConnection) => Promise<void>,
): Promise<void> {
  const db = await createDb(dbPath);
  const conn = await db.connect();
  try {
    await fn(conn);
  } finally {
    conn.closeSync();
  }
}

async function queryCategories(conn: DuckDBConnection, indicator: string): Promise<string[]> {
  const reader = await conn.runAndReadAll(
    `SELECT category FROM statistics WHERE indicator = ? AND area_type = 'district'
     GROUP BY category ORDER BY category ASC`,
    [indicator],
  );
  return reader.getRowObjects().map((r) => String(r['category']));
}

async function queryYears(
  conn: DuckDBConnection,
  indicator: string,
  category = 'total',
): Promise<number[]> {
  const reader = await conn.runAndReadAll(
    `SELECT DISTINCT year FROM statistics
     WHERE indicator = ? AND area_type = 'district' AND category = ?
     ORDER BY year ASC`,
    [indicator, category],
  );
  return reader.getRowObjects().map((r) => Number(r['year']));
}

async function queryAreas(conn: DuckDBConnection, indicator: string): Promise<string[]> {
  const reader = await conn.runAndReadAll(
    `SELECT DISTINCT area_name FROM statistics
     WHERE indicator = ? AND area_type = 'district'
     ORDER BY area_name ASC`,
    [indicator],
  );
  return reader.getRowObjects().map((r) => String(r['area_name']));
}

async function queryValue(
  conn: DuckDBConnection,
  indicator: string,
  area: string,
  year: number,
  category = 'total',
): Promise<number> {
  const reader = await conn.runAndReadAll(
    `SELECT value FROM statistics
     WHERE indicator = ? AND area_type = 'district' AND area_name = ? AND year = ? AND category = ?`,
    [indicator, area, year, category],
  );
  return Number(reader.getRowObjects()[0]?.['value']);
}

async function queryCount(
  conn: DuckDBConnection,
  indicator: string,
  category?: string,
): Promise<number> {
  const params: (string | number)[] = [indicator];
  let sql = `SELECT COUNT(*) AS c FROM statistics WHERE indicator = ? AND area_type = 'district'`;
  if (category !== undefined) {
    sql += ` AND category = ?`;
    params.push(category);
  }
  const reader = await conn.runAndReadAll(sql, params);
  return Number(reader.getRowObjects()[0]?.['c']);
}

// ── Tests ──────────────────────────────────────────────────────────────────

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

    await withConn(dbPath, async (conn) => {
      expect(await queryCount(conn, 'population')).toBe(4);
    });
  });

  it('throws when required columns are missing', async () => {
    const csv = ['Name;2022;2023', 'Altstadt;1213;1220'].join('\n') + '\n';

    await fs.writeFile(csvPath, csv, 'utf8');

    await expect(importDataset(DISTRICTS_POPULATION, { csvPath, dbPath })).rejects.toThrow(
      /Missing required columns.*Merkmal.*Stadtteil/i,
    );
  });

  it('normalizes spaced headers before required column checks', async () => {
    const csv =
      [' Merkmal ; Stadtteil ;2022', 'Einwohner insgesamt;Altstadt;1213'].join('\n') + '\n';

    await fs.writeFile(csvPath, csv, 'utf8');

    const res = await importDataset(DISTRICTS_POPULATION, { csvPath, dbPath });
    expect(res.imported).toBe(1);
  });

  it('throws when CSV file does not exist', async () => {
    const missing = path.join(cacheDir, 'nonexistent.csv');

    await expect(importDataset(DISTRICTS_POPULATION, { csvPath: missing, dbPath })).rejects.toThrow(
      /CSV file not found/i,
    );
  });

  it('imports with csv path containing apostrophe', async () => {
    const specialCsvPath = path.join(cacheDir, "population'o.csv");
    const csv =
      ['Merkmal;Stadtteil;2022;2023', 'Einwohner insgesamt;Altstadt;1213;1220'].join('\n') + '\n';

    await fs.writeFile(specialCsvPath, csv, 'utf8');

    const res = await importDataset(DISTRICTS_POPULATION, { csvPath: specialCsvPath, dbPath });
    expect(res.imported).toBe(2);
  });

  it('throws when no year columns exist', async () => {
    const csv =
      ['Merkmal;Stadtteil;foo;bar', 'Einwohner insgesamt;Altstadt;1213;1220'].join('\n') + '\n';

    await fs.writeFile(csvPath, csv, 'utf8');

    await expect(importDataset(DISTRICTS_POPULATION, { csvPath, dbPath })).rejects.toThrow(
      /No year columns found/i,
    );
  });

  it('throws descriptive error when unpivot_years yearParser returns NaN', async () => {
    const csv =
      [
        'Land;Stadt;Kategorie;Merkmal;Stadtteilnummer;Stadtteil;31.12.2023;31.12.2022',
        'de-sh;Kiel;wirtschaft_arbeit;Arbeitslose;1;Altstadt;16;14',
      ].join('\n') + '\n';
    const unemployedCsvPath = path.join(cacheDir, DISTRICTS_UNEMPLOYED_COUNT.csvFilename);
    await fs.writeFile(unemployedCsvPath, csv, 'utf8');

    if (DISTRICTS_UNEMPLOYED_COUNT.format.type !== 'unpivot_years') {
      throw new Error('Expected unpivot_years format for DISTRICTS_UNEMPLOYED_COUNT');
    }

    const brokenConfig = {
      ...DISTRICTS_UNEMPLOYED_COUNT,
      format: {
        ...DISTRICTS_UNEMPLOYED_COUNT.format,
        yearParser: () => Number.NaN,
      },
    };

    await expect(
      importDataset(brokenConfig, { csvPath: unemployedCsvPath, dbPath }),
    ).rejects.toThrow(/Invalid yearParser output.*unpivot_years.*NaN.*allowedRange=1900\.\.2100/i);
  });

  it('throws descriptive error when unpivot_categories yearParser returns NaN', async () => {
    const csv =
      [
        'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;1;Altstadt;1220;638;582',
      ].join('\n') + '\n';
    const genderCsvPath = path.join(cacheDir, DISTRICTS_GENDER.csvFilename);
    await fs.writeFile(genderCsvPath, csv, 'utf8');

    if (DISTRICTS_GENDER.format.type !== 'unpivot_categories') {
      throw new Error('Expected unpivot_categories format for DISTRICTS_GENDER');
    }

    const brokenConfig = {
      ...DISTRICTS_GENDER,
      format: {
        ...DISTRICTS_GENDER.format,
        yearParser: () => Number.NaN,
      },
    };

    await expect(importDataset(brokenConfig, { csvPath: genderCsvPath, dbPath })).rejects.toThrow(
      /Invalid yearParser output.*unpivot_categories.*NaN.*allowedRange=1900\.\.2100/i,
    );
  });

  it('throws when unpivot_years yearParser returns year out of range', async () => {
    const csv =
      [
        'Land;Stadt;Kategorie;Merkmal;Stadtteilnummer;Stadtteil;31.12.2023;31.12.2022',
        'de-sh;Kiel;wirtschaft_arbeit;Arbeitslose;1;Altstadt;16;14',
      ].join('\n') + '\n';
    const unemployedCsvPath = path.join(cacheDir, DISTRICTS_UNEMPLOYED_COUNT.csvFilename);
    await fs.writeFile(unemployedCsvPath, csv, 'utf8');

    if (DISTRICTS_UNEMPLOYED_COUNT.format.type !== 'unpivot_years') {
      throw new Error('Expected unpivot_years format for DISTRICTS_UNEMPLOYED_COUNT');
    }

    const brokenConfig = {
      ...DISTRICTS_UNEMPLOYED_COUNT,
      format: {
        ...DISTRICTS_UNEMPLOYED_COUNT.format,
        yearParser: () => 2201,
      },
    };

    await expect(
      importDataset(brokenConfig, { csvPath: unemployedCsvPath, dbPath }),
    ).rejects.toThrow(/Invalid yearParser output.*unpivot_years.*2201.*allowedRange=1900\.\.2100/i);
  });

  it('throws when unpivot_categories yearParser returns year out of range', async () => {
    const csv =
      [
        'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;1;Altstadt;1220;638;582',
      ].join('\n') + '\n';
    const genderCsvPath = path.join(cacheDir, DISTRICTS_GENDER.csvFilename);
    await fs.writeFile(genderCsvPath, csv, 'utf8');

    if (DISTRICTS_GENDER.format.type !== 'unpivot_categories') {
      throw new Error('Expected unpivot_categories format for DISTRICTS_GENDER');
    }

    const brokenConfig = {
      ...DISTRICTS_GENDER,
      format: {
        ...DISTRICTS_GENDER.format,
        yearParser: () => 1800,
      },
    };

    await expect(importDataset(brokenConfig, { csvPath: genderCsvPath, dbPath })).rejects.toThrow(
      /Invalid yearParser output.*unpivot_categories.*1800.*allowedRange=1900\.\.2100/i,
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

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'households')).toEqual([
        'couple_no_children',
        'couple_with_children',
        'couple_with_descendants',
        'other_multi_person',
        'single_parent',
        'single_person',
        'total',
      ]);
      expect(await queryCount(conn, 'households', 'total')).toBe(4);
    });
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

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'marital_status')).toEqual([
        'divorced',
        'married',
        'single',
        'total',
        'widowed',
      ]);
      expect(await queryCount(conn, 'marital_status', 'total')).toBe(4);
    });
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

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'gender')).toEqual(['female', 'male', 'total']);
      expect(await queryYears(conn, 'gender')).toEqual([2022, 2023]);
      expect(await queryValue(conn, 'gender', 'Altstadt', 2022)).toBe(1213);
    });
  });

  it('imports foreign gender categories with dedupe and trimmed area names', async () => {
    const foreignGenderCsv =
      [
        'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
        'de-sh;Kiel;Bevoelkerung;Auslaender;2022_12_31;1;Altstadt   ;200;120;80',
        'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt   ;210;125;85',
        'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt   ;212;127;85',
        'de-sh;Kiel;Bevoelkerung;Auslaender;2022_12_31;2;Vorstadt;320;158;162',
        'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;2;Vorstadt;324;160;164',
        'de-sh;Kiel;Bevoelkerung;Nicht relevant;2023_12_31;2;Vorstadt;9999;1;1',
      ].join('\n') + '\n';

    const foreignGenderCsvPath = path.join(cacheDir, DISTRICTS_FOREIGN_GENDER.csvFilename);
    await fs.writeFile(foreignGenderCsvPath, foreignGenderCsv, 'utf8');

    const first = await importDataset(DISTRICTS_FOREIGN_GENDER, {
      csvPath: foreignGenderCsvPath,
      dbPath,
    });
    const second = await importDataset(DISTRICTS_FOREIGN_GENDER, {
      csvPath: foreignGenderCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(12);
    expect(second.imported).toBe(12);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'foreign_gender')).toEqual(['female', 'male', 'total']);
      expect(await queryYears(conn, 'foreign_gender')).toEqual([2022, 2023]);
      expect(await queryAreas(conn, 'foreign_gender')).toEqual(['Altstadt', 'Vorstadt']);
      expect(await queryValue(conn, 'foreign_gender', 'Altstadt', 2023)).toBe(212);
      expect(await queryValue(conn, 'foreign_gender', 'Altstadt', 2023, 'male')).toBe(127);
    });
  });

  it('keeps last CSV row deterministically when deduping by area and year', async () => {
    const foreignGenderCsv =
      [
        'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
        'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt;100;10;90',
        'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt;200;20;180',
        'de-sh;Kiel;Bevoelkerung;Auslaender;2023_12_31;1;Altstadt;300;30;270',
      ].join('\n') + '\n';

    const foreignGenderCsvPath = path.join(cacheDir, DISTRICTS_FOREIGN_GENDER.csvFilename);
    await fs.writeFile(foreignGenderCsvPath, foreignGenderCsv, 'utf8');

    const first = await importDataset(DISTRICTS_FOREIGN_GENDER, {
      csvPath: foreignGenderCsvPath,
      dbPath,
    });
    const second = await importDataset(DISTRICTS_FOREIGN_GENDER, {
      csvPath: foreignGenderCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(3);
    expect(second.imported).toBe(3);

    await withConn(dbPath, async (conn) => {
      expect(await queryValue(conn, 'foreign_gender', 'Altstadt', 2023)).toBe(300);
      expect(await queryValue(conn, 'foreign_gender', 'Altstadt', 2023, 'male')).toBe(30);
      expect(await queryValue(conn, 'foreign_gender', 'Altstadt', 2023, 'female')).toBe(270);
    });
  });

  it('imports migrant gender categories with dedupe and trimmed area names', async () => {
    const migrantGenderCsv =
      [
        'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;m\u00e4nnlich;weiblich',
        'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2022_12_31;1;Altstadt   ;350;190;160',
        'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2023_12_31;1;Altstadt   ;360;195;165',
        'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2023_12_31;1;Altstadt   ;364;199;165',
        'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2022_12_31;2;Vorstadt;500;245;255',
        'de-sh;Kiel;Bev\u00f6lkerung;Einwohner mit Migrationshintergrund;2023_12_31;2;Vorstadt;518;253;265',
        'de-sh;Kiel;Bev\u00f6lkerung;Nicht relevant;2023_12_31;2;Vorstadt;9999;1;1',
      ].join('\n') + '\n';

    const migrantGenderCsvPath = path.join(cacheDir, DISTRICTS_MIGRANT_GENDER.csvFilename);
    await fs.writeFile(migrantGenderCsvPath, migrantGenderCsv, 'utf8');

    const first = await importDataset(DISTRICTS_MIGRANT_GENDER, {
      csvPath: migrantGenderCsvPath,
      dbPath,
    });
    const second = await importDataset(DISTRICTS_MIGRANT_GENDER, {
      csvPath: migrantGenderCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(12);
    expect(second.imported).toBe(12);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'migrant_gender')).toEqual(['female', 'male', 'total']);
      expect(await queryYears(conn, 'migrant_gender')).toEqual([2022, 2023]);
      expect(await queryAreas(conn, 'migrant_gender')).toEqual(['Altstadt', 'Vorstadt']);
      expect(await queryValue(conn, 'migrant_gender', 'Altstadt', 2023)).toBe(364);
    });
  });

  it('imports foreign count from year columns with trimmed area names', async () => {
    const foreignCountCsv =
      [
        'Kategorie;Merkmal;Stadtteilnummer;Stadtteil;2022;2023',
        'Bevoelkerung;Auslaender;1;Altstadt   ;214;212',
        'Bevoelkerung;Auslaender;2;Vorstadt      ;288;324',
        'Bevoelkerung;Nicht relevant;2;Vorstadt;999;999',
      ].join('\n') + '\n';

    const foreignCountCsvPath = path.join(cacheDir, DISTRICTS_FOREIGN_COUNT.csvFilename);
    await fs.writeFile(foreignCountCsvPath, foreignCountCsv, 'utf8');

    const first = await importDataset(DISTRICTS_FOREIGN_COUNT, {
      csvPath: foreignCountCsvPath,
      dbPath,
    });
    const second = await importDataset(DISTRICTS_FOREIGN_COUNT, {
      csvPath: foreignCountCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(4);
    expect(second.imported).toBe(4);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'foreign_count')).toEqual(['total']);
      expect(await queryYears(conn, 'foreign_count')).toEqual([2022, 2023]);
      expect(await queryAreas(conn, 'foreign_count')).toEqual(['Altstadt', 'Vorstadt']);
      expect(await queryValue(conn, 'foreign_count', 'Altstadt', 2023)).toBe(212);
    });
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

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'age_groups')).toEqual([
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
      expect(await queryYears(conn, 'age_groups')).toEqual([2022, 2023]);
      expect(await queryValue(conn, 'age_groups', 'Altstadt', 2023)).toBe(1220);
    });
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

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'area_hectares')).toEqual(['total']);
      expect(await queryYears(conn, 'area_hectares')).toEqual([2019, 2020]);
      expect(await queryValue(conn, 'area_hectares', 'Altstadt', 2020)).toBeCloseTo(35.0987, 6);
    });
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

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'unemployed_count')).toEqual(['total']);
      expect(await queryYears(conn, 'unemployed_count')).toEqual([2022, 2023]);
      expect(await queryValue(conn, 'unemployed_count', 'Altstadt', 2023)).toBe(16);
    });
  });

  it('imports unemployed rate from date-like year columns with decimal comma', async () => {
    const unemployedRateCsv =
      [
        'Land;Stadt;Kategorie;Merkmal;Stadtteilnummer;Stadtteil;31.12.2019;31.12.2018',
        'de-sh;Kiel;wirtschaft_arbeit;Betroffenheitsquote;1;Altstadt;1,6;2,3',
        'de-sh;Kiel;wirtschaft_arbeit;Betroffenheitsquote;2;Vorstadt;4,2;3,8',
      ].join('\n') + '\n';

    const unemployedRateCsvPath = path.join(cacheDir, DISTRICTS_UNEMPLOYED_RATE.csvFilename);
    await fs.writeFile(unemployedRateCsvPath, unemployedRateCsv, 'utf8');

    const first = await importDataset(DISTRICTS_UNEMPLOYED_RATE, {
      csvPath: unemployedRateCsvPath,
      dbPath,
    });
    const second = await importDataset(DISTRICTS_UNEMPLOYED_RATE, {
      csvPath: unemployedRateCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(4);
    expect(second.imported).toBe(4);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'unemployed_rate')).toEqual(['total']);
      expect(await queryYears(conn, 'unemployed_rate')).toEqual([2018, 2019]);
      expect(await queryValue(conn, 'unemployed_rate', 'Altstadt', 2019)).toBeCloseTo(1.6, 6);
    });
  });

  it('imports religion categories including computed total', async () => {
    const religionCsv =
      [
        'Land;Stadt;Kategorie;Jahr;Stadtteil;evangelisch;katholisch;sonstige/ohne',
        'de-sh;Kiel;Bevoelkerung;2022;Altstadt;340;90;770',
        'de-sh;Kiel;Bevoelkerung;2023;Altstadt;344;89;787',
        'de-sh;Kiel;Bevoelkerung;2022;Vorstadt;410;94;1096',
        'de-sh;Kiel;Bevoelkerung;2023;Vorstadt;414;95;1139',
      ].join('\n') + '\n';

    const religionCsvPath = path.join(cacheDir, DISTRICTS_RELIGION.csvFilename);
    await fs.writeFile(religionCsvPath, religionCsv, 'utf8');

    const first = await importDataset(DISTRICTS_RELIGION, { csvPath: religionCsvPath, dbPath });
    const second = await importDataset(DISTRICTS_RELIGION, { csvPath: religionCsvPath, dbPath });

    expect(first.imported).toBe(16);
    expect(second.imported).toBe(16);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'religion')).toEqual([
        'catholic',
        'evangelical',
        'other_or_none',
        'total',
      ]);
      expect(await queryYears(conn, 'religion')).toEqual([2022, 2023]);
      expect(await queryValue(conn, 'religion', 'Altstadt', 2023)).toBe(1220);
    });
  });

  it('imports selected foreign nationalities with trimmed area and empty values as zero', async () => {
    const foreignNationalitiesCsv =
      [
        'Land;Stadt;Kategorie;Jahr;Stadtteil;Tuerkei;Polen;Irak;Russland;Ukraine;Syrien;Bulgarien',
        'de-sh;Kiel;Bevoelkerung;2022;Altstadt   ;7;3;8;15;20;6;5',
        'de-sh;Kiel;Bevoelkerung;2023;Altstadt        ;8;4;9;16;21;7;6',
        'de-sh;Kiel;Bevoelkerung;2022;Vorstadt      ;10;7;4;20;14;10;',
        'de-sh;Kiel;Bevoelkerung;2023;Vorstadt      ;11;8;5;22;16;12;1',
      ].join('\n') + '\n';

    const foreignNationalitiesCsvPath = path.join(
      cacheDir,
      DISTRICTS_FOREIGN_NATIONALITIES_SELECTED.csvFilename,
    );
    await fs.writeFile(foreignNationalitiesCsvPath, foreignNationalitiesCsv, 'utf8');

    const first = await importDataset(DISTRICTS_FOREIGN_NATIONALITIES_SELECTED, {
      csvPath: foreignNationalitiesCsvPath,
      dbPath,
    });
    const second = await importDataset(DISTRICTS_FOREIGN_NATIONALITIES_SELECTED, {
      csvPath: foreignNationalitiesCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(32);
    expect(second.imported).toBe(32);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'foreign_nationalities_selected')).toEqual([
        'bulgaria',
        'iraq',
        'poland',
        'russia',
        'syria',
        'total',
        'turkey',
        'ukraine',
      ]);
      expect(await queryYears(conn, 'foreign_nationalities_selected')).toEqual([2022, 2023]);
      expect(await queryAreas(conn, 'foreign_nationalities_selected')).toEqual([
        'Altstadt',
        'Vorstadt',
      ]);
      expect(
        await queryValue(conn, 'foreign_nationalities_selected', 'Vorstadt', 2022, 'bulgaria'),
      ).toBe(0);
      expect(await queryValue(conn, 'foreign_nationalities_selected', 'Altstadt', 2023)).toBe(71);
    });
  });

  it('imports foreign age groups with trimmed headers and empty values as zero', async () => {
    const foreignAgeGroupsCsv =
      [
        'Land;Stadt;Kategorie;Datum;Stadtteilnummer;Merkmal;Stadtteil;0 bis unter 3;3 bis unter 6; 6 bis unter 10;10 bis unter 12;12 bis unter 15;15 bis unter 18;18 bis unter 21;21 bis unter 25;25 bis unter 30;30 bis unter 35;35 bis unter 40;40 bis unter 45;45 bis unter 50;50 bis unter 55;55 bis unter 60;60 bis unter 65;65 bis unter 70;70 bis unter 75;75 bis unter 80;80 und aelter',
        'de-sh;Kiel;Bevoelkerung;2022_12_31;1;Einwohner nach Altersgruppen;Altstadt   ;4;2;4;3;;5;6;27;32;30;23;17;15;13;10;5;7;4;2;3',
        'de-sh;Kiel;Bevoelkerung;2023_12_31;1;Einwohner nach Altersgruppen;Altstadt        ;4;2;4;3;;5;6;27;32;30;23;17;15;13;10;5;7;4;2;3',
        'de-sh;Kiel;Bevoelkerung;2022_12_31;2;Einwohner nach Altersgruppen;Vorstadt      ;10;15;16;2;8;7;6;22;67;56;28;17;16;16;13;7;4;5;2;7',
        'de-sh;Kiel;Bevoelkerung;2023_12_31;2;Einwohner nach Altersgruppen;Vorstadt      ;10;15;16;2;8;7;6;22;67;56;28;17;16;16;13;7;4;5;2;7',
      ].join('\n') + '\n';

    const foreignAgeGroupsCsvPath = path.join(cacheDir, DISTRICTS_FOREIGN_AGE_GROUPS.csvFilename);
    await fs.writeFile(foreignAgeGroupsCsvPath, foreignAgeGroupsCsv, 'utf8');

    const first = await importDataset(DISTRICTS_FOREIGN_AGE_GROUPS, {
      csvPath: foreignAgeGroupsCsvPath,
      dbPath,
    });
    const second = await importDataset(DISTRICTS_FOREIGN_AGE_GROUPS, {
      csvPath: foreignAgeGroupsCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(84);
    expect(second.imported).toBe(84);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'foreign_age_groups')).toEqual([
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
      expect(await queryYears(conn, 'foreign_age_groups')).toEqual([2022, 2023]);
      expect(await queryAreas(conn, 'foreign_age_groups')).toEqual(['Altstadt', 'Vorstadt']);
      expect(await queryValue(conn, 'foreign_age_groups', 'Altstadt', 2023, 'age_12_14')).toBe(0);
      expect(await queryValue(conn, 'foreign_age_groups', 'Altstadt', 2023)).toBe(212);
    });
  });

  it('rolls back unpivot_years imports and preserves previous data on failure', async () => {
    const csv =
      [
        'Merkmal;Stadtteil;2022;2023',
        'Einwohner insgesamt;Altstadt;1213;1220',
        'Einwohner insgesamt;Gaarden-Ost;17900;18000',
      ].join('\n') + '\n';

    await fs.writeFile(csvPath, csv, 'utf8');

    const first = await importDataset(DISTRICTS_POPULATION, { csvPath, dbPath });
    expect(first.imported).toBe(4);

    if (DISTRICTS_POPULATION.format.type !== 'unpivot_years') {
      throw new Error('Expected unpivot_years format for DISTRICTS_POPULATION');
    }

    const brokenConfig = {
      ...DISTRICTS_POPULATION,
      format: {
        ...DISTRICTS_POPULATION.format,
        rows: DISTRICTS_POPULATION.format.rows.map((row, index) =>
          index === 0 ? { ...row, valueExpression: `CAST('not-a-number' AS INTEGER)` } : row,
        ),
      },
    };

    await expect(importDataset(brokenConfig, { csvPath, dbPath })).rejects.toThrow();

    await withConn(dbPath, async (conn) => {
      expect(await queryCount(conn, 'population', 'total')).toBe(4);
      expect(await queryValue(conn, 'population', 'Altstadt', 2023)).toBe(1220);
    });
  });

  it('rolls back unpivot_categories imports and preserves previous data on failure', async () => {
    const genderCsv =
      [
        'Land;Stadt;Kategorie;Merkmal;Datum;Stadtteilnummer;Stadtteil;insgesamt;maennlich;weiblich',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2022_12_31;1;Altstadt;1213;631;582',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;1;Altstadt;1220;638;582',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2022_12_31;2;Vorstadt;1600;800;800',
        'de-sh;Kiel;Bevoelkerung;Einwohner insgesamt;2023_12_31;2;Vorstadt;1648;829;819',
      ].join('\n') + '\n';

    const genderCsvPath = path.join(cacheDir, DISTRICTS_GENDER.csvFilename);
    await fs.writeFile(genderCsvPath, genderCsv, 'utf8');

    const first = await importDataset(DISTRICTS_GENDER, { csvPath: genderCsvPath, dbPath });
    expect(first.imported).toBe(12);

    if (DISTRICTS_GENDER.format.type !== 'unpivot_categories') {
      throw new Error('Expected unpivot_categories format for DISTRICTS_GENDER');
    }

    const brokenConfig = {
      ...DISTRICTS_GENDER,
      format: {
        ...DISTRICTS_GENDER.format,
        columns: DISTRICTS_GENDER.format.columns.map((column, index) =>
          index === 0 ? { ...column, valueExpression: `CAST('not-a-number' AS INTEGER)` } : column,
        ),
      },
    };

    await expect(importDataset(brokenConfig, { csvPath: genderCsvPath, dbPath })).rejects.toThrow();

    await withConn(dbPath, async (conn) => {
      expect(await queryCount(conn, 'gender', 'total')).toBe(4);
      expect(await queryValue(conn, 'gender', 'Altstadt', 2023)).toBe(1220);
    });
  });
});
