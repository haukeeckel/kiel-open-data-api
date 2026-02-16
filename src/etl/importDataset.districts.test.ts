import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  districtsAgeGroupsCsvFixture,
  districtsAreaHectaresCsvFixture,
  districtsForeignAgeGroupsCsvFixture,
  districtsForeignCountCsvFixture,
  districtsForeignGenderCsvFixture,
  districtsForeignGenderDedupeCsvFixture,
  districtsForeignNationalitiesSelectedCsvFixture,
  districtsGenderCsvFixture,
  districtsHouseholdsCsvFixture,
  districtsMaritalStatusCsvFixture,
  districtsMigrantGenderCsvFixture,
  districtsPopulationCsvFixture,
  districtsReligionCsvFixture,
  districtsUnemployedCountCsvFixture,
  districtsUnemployedRateCsvFixture,
} from '../test/fixtures/etlImport.fixtures.js';
import { withTestEnv } from '../test/helpers/env.js';
import {
  copyDbSnapshot,
  mkTmpDir,
  prepareMigratedDb,
  queryAreas,
  queryCategories,
  queryCount,
  queryValue,
  queryYears,
  withConn,
} from '../test/helpers/etlImportDb.js';

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe('importDataset', () => {
  let suiteTmp: string;
  let templateDbPath: string;
  let tmp: string;
  let cacheDir: string;
  let dbPath: string;
  let restoreEnv: (() => void) | null = null;

  beforeAll(async () => {
    suiteTmp = mkTmpDir();
    templateDbPath = path.join(suiteTmp, 'template.duckdb');
    await prepareMigratedDb(templateDbPath);
  });

  beforeEach(async () => {
    tmp = mkTmpDir();
    cacheDir = path.join(tmp, 'data', 'cache');
    dbPath = path.join(cacheDir, 'test.duckdb');

    await fs.mkdir(cacheDir, { recursive: true });
    await copyDbSnapshot(templateDbPath, dbPath);

    restoreEnv = withTestEnv({ NODE_ENV: 'test' });
  });

  afterEach(() => {
    restoreEnv?.();
    restoreEnv = null;
    try {
      fssync.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  afterAll(() => {
    try {
      fssync.rmSync(suiteTmp, { recursive: true, force: true });
    } catch {}
  });

  it('imports districts population into statistics table', async () => {
    const csvPath = path.join(cacheDir, DISTRICTS_POPULATION.csvFilename);
    const csv = districtsPopulationCsvFixture();

    await fs.writeFile(csvPath, csv, 'utf8');

    const res = await importDataset(DISTRICTS_POPULATION, { csvPath, dbPath });

    expect(res.csvPath).toBe(csvPath);
    expect(res.dbPath).toBe(dbPath);
    expect(res.imported).toBe(4);

    await withConn(dbPath, async (conn) => {
      expect(await queryCount(conn, 'population', 'district')).toBe(4);
    });
  });

  it('imports multiple household categories and can reimport deterministically', async () => {
    const csvPath = path.join(cacheDir, DISTRICTS_HOUSEHOLDS_TYPE_SIZE.csvFilename);
    const householdsCsv = districtsHouseholdsCsvFixture();

    await fs.writeFile(csvPath, householdsCsv, 'utf8');

    const first = await importDataset(DISTRICTS_HOUSEHOLDS_TYPE_SIZE, { csvPath, dbPath });
    const second = await importDataset(DISTRICTS_HOUSEHOLDS_TYPE_SIZE, { csvPath, dbPath });

    expect(first.imported).toBe(28);
    expect(second.imported).toBe(28);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'households', 'district')).toEqual([
        'couple_no_children',
        'couple_with_children',
        'couple_with_descendants',
        'other_multi_person',
        'single_parent',
        'single_person',
        'total',
      ]);
      expect(await queryCount(conn, 'households', 'district', 'total')).toBe(4);
    });
  });

  it('imports marital status categories including computed total', async () => {
    const maritalStatusCsv = districtsMaritalStatusCsvFixture();

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
      expect(await queryCategories(conn, 'marital_status', 'district')).toEqual([
        'divorced',
        'married',
        'single',
        'total',
        'widowed',
      ]);
      expect(await queryCount(conn, 'marital_status', 'district', 'total')).toBe(4);
    });
  });

  it('imports gender categories and parses year from Datum', async () => {
    const genderCsv = districtsGenderCsvFixture();

    const genderCsvPath = path.join(cacheDir, DISTRICTS_GENDER.csvFilename);
    await fs.writeFile(genderCsvPath, genderCsv, 'utf8');

    const first = await importDataset(DISTRICTS_GENDER, { csvPath: genderCsvPath, dbPath });
    const second = await importDataset(DISTRICTS_GENDER, { csvPath: genderCsvPath, dbPath });

    expect(first.imported).toBe(12);
    expect(second.imported).toBe(12);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'gender', 'district')).toEqual([
        'female',
        'male',
        'total',
      ]);
      expect(await queryYears(conn, 'gender', 'district')).toEqual([2022, 2023]);
      expect(await queryValue(conn, 'gender', 'district', 'Altstadt', 2022)).toBe(1213);
    });
  });

  it('imports foreign gender categories with dedupe and trimmed area names', async () => {
    const foreignGenderCsv = districtsForeignGenderCsvFixture();

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
      expect(await queryCategories(conn, 'foreign_gender', 'district')).toEqual([
        'female',
        'male',
        'total',
      ]);
      expect(await queryYears(conn, 'foreign_gender', 'district')).toEqual([2022, 2023]);
      expect(await queryAreas(conn, 'foreign_gender', 'district')).toEqual([
        'Altstadt',
        'Vorstadt',
      ]);
      expect(await queryValue(conn, 'foreign_gender', 'district', 'Altstadt', 2023)).toBe(212);
      expect(await queryValue(conn, 'foreign_gender', 'district', 'Altstadt', 2023, 'male')).toBe(
        127,
      );
    });
  });

  it('keeps last CSV row deterministically when deduping by area and year', async () => {
    const foreignGenderCsv = districtsForeignGenderDedupeCsvFixture();

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
      expect(await queryValue(conn, 'foreign_gender', 'district', 'Altstadt', 2023)).toBe(300);
      expect(await queryValue(conn, 'foreign_gender', 'district', 'Altstadt', 2023, 'male')).toBe(
        30,
      );
      expect(await queryValue(conn, 'foreign_gender', 'district', 'Altstadt', 2023, 'female')).toBe(
        270,
      );
    });
  });

  it('imports migrant gender categories with dedupe and trimmed area names', async () => {
    const migrantGenderCsv = districtsMigrantGenderCsvFixture();

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
      expect(await queryCategories(conn, 'migrant_gender', 'district')).toEqual([
        'female',
        'male',
        'total',
      ]);
      expect(await queryYears(conn, 'migrant_gender', 'district')).toEqual([2022, 2023]);
      expect(await queryAreas(conn, 'migrant_gender', 'district')).toEqual([
        'Altstadt',
        'Vorstadt',
      ]);
      expect(await queryValue(conn, 'migrant_gender', 'district', 'Altstadt', 2023)).toBe(364);
    });
  });

  it('imports foreign count from year columns with trimmed area names', async () => {
    const foreignCountCsv = districtsForeignCountCsvFixture();

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
      expect(await queryCategories(conn, 'foreign_count', 'district')).toEqual(['total']);
      expect(await queryYears(conn, 'foreign_count', 'district')).toEqual([2022, 2023]);
      expect(await queryAreas(conn, 'foreign_count', 'district')).toEqual(['Altstadt', 'Vorstadt']);
      expect(await queryValue(conn, 'foreign_count', 'district', 'Altstadt', 2023)).toBe(212);
    });
  });

  it('imports age group categories including computed total', async () => {
    const ageGroupsCsv = districtsAgeGroupsCsvFixture();

    const ageGroupsCsvPath = path.join(cacheDir, DISTRICTS_AGE_GROUPS.csvFilename);
    await fs.writeFile(ageGroupsCsvPath, ageGroupsCsv, 'utf8');

    const first = await importDataset(DISTRICTS_AGE_GROUPS, { csvPath: ageGroupsCsvPath, dbPath });
    const second = await importDataset(DISTRICTS_AGE_GROUPS, { csvPath: ageGroupsCsvPath, dbPath });

    expect(first.imported).toBe(84);
    expect(second.imported).toBe(84);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'age_groups', 'district')).toEqual([
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
      expect(await queryYears(conn, 'age_groups', 'district')).toEqual([2022, 2023]);
      expect(await queryValue(conn, 'age_groups', 'district', 'Altstadt', 2023)).toBe(1220);
    });
  });

  it('imports area hectares with decimal comma parsing', async () => {
    const areaCsv = districtsAreaHectaresCsvFixture();

    const areaCsvPath = path.join(cacheDir, DISTRICTS_AREA_HECTARES.csvFilename);
    await fs.writeFile(areaCsvPath, areaCsv, 'utf8');

    const first = await importDataset(DISTRICTS_AREA_HECTARES, { csvPath: areaCsvPath, dbPath });
    const second = await importDataset(DISTRICTS_AREA_HECTARES, { csvPath: areaCsvPath, dbPath });

    expect(first.imported).toBe(4);
    expect(second.imported).toBe(4);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'area_hectares', 'district')).toEqual(['total']);
      expect(await queryYears(conn, 'area_hectares', 'district')).toEqual([2019, 2020]);
      expect(await queryValue(conn, 'area_hectares', 'district', 'Altstadt', 2020)).toBeCloseTo(
        35.0987,
        6,
      );
    });
  });

  it('imports unemployed counts from date-like year columns', async () => {
    const unemployedCsv = districtsUnemployedCountCsvFixture();

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
      expect(await queryCategories(conn, 'unemployed_count', 'district')).toEqual(['total']);
      expect(await queryYears(conn, 'unemployed_count', 'district')).toEqual([2022, 2023]);
      expect(await queryValue(conn, 'unemployed_count', 'district', 'Altstadt', 2023)).toBe(16);
    });
  });

  it('imports unemployed rate from date-like year columns with decimal comma', async () => {
    const unemployedRateCsv = districtsUnemployedRateCsvFixture();

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
      expect(await queryCategories(conn, 'unemployed_rate', 'district')).toEqual(['total']);
      expect(await queryYears(conn, 'unemployed_rate', 'district')).toEqual([2018, 2019]);
      expect(await queryValue(conn, 'unemployed_rate', 'district', 'Altstadt', 2019)).toBeCloseTo(
        1.6,
        6,
      );
    });
  });

  it('imports religion categories including computed total', async () => {
    const religionCsv = districtsReligionCsvFixture();

    const religionCsvPath = path.join(cacheDir, DISTRICTS_RELIGION.csvFilename);
    await fs.writeFile(religionCsvPath, religionCsv, 'utf8');

    const first = await importDataset(DISTRICTS_RELIGION, { csvPath: religionCsvPath, dbPath });
    const second = await importDataset(DISTRICTS_RELIGION, { csvPath: religionCsvPath, dbPath });

    expect(first.imported).toBe(16);
    expect(second.imported).toBe(16);

    await withConn(dbPath, async (conn) => {
      expect(await queryCategories(conn, 'religion', 'district')).toEqual([
        'catholic',
        'evangelical',
        'other_or_none',
        'total',
      ]);
      expect(await queryYears(conn, 'religion', 'district')).toEqual([2022, 2023]);
      expect(await queryValue(conn, 'religion', 'district', 'Altstadt', 2023)).toBe(1220);
    });
  });

  it('imports selected foreign nationalities with trimmed area and empty values as zero', async () => {
    const foreignNationalitiesCsv = districtsForeignNationalitiesSelectedCsvFixture();

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
      expect(await queryCategories(conn, 'foreign_nationalities_selected', 'district')).toEqual([
        'bulgaria',
        'iraq',
        'poland',
        'russia',
        'syria',
        'total',
        'turkey',
        'ukraine',
      ]);
      expect(await queryYears(conn, 'foreign_nationalities_selected', 'district')).toEqual([
        2022, 2023,
      ]);
      expect(await queryAreas(conn, 'foreign_nationalities_selected', 'district')).toEqual([
        'Altstadt',
        'Vorstadt',
      ]);
      expect(
        await queryValue(
          conn,
          'foreign_nationalities_selected',
          'district',
          'Vorstadt',
          2022,
          'bulgaria',
        ),
      ).toBe(0);
      expect(
        await queryValue(conn, 'foreign_nationalities_selected', 'district', 'Altstadt', 2023),
      ).toBe(71);
    });
  });

  it('imports foreign age groups with trimmed headers and empty values as zero', async () => {
    const foreignAgeGroupsCsv = districtsForeignAgeGroupsCsvFixture();

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
      expect(await queryCategories(conn, 'foreign_age_groups', 'district')).toEqual([
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
      expect(await queryYears(conn, 'foreign_age_groups', 'district')).toEqual([2022, 2023]);
      expect(await queryAreas(conn, 'foreign_age_groups', 'district')).toEqual([
        'Altstadt',
        'Vorstadt',
      ]);
      expect(
        await queryValue(conn, 'foreign_age_groups', 'district', 'Altstadt', 2023, 'age_12_14'),
      ).toBe(0);
      expect(await queryValue(conn, 'foreign_age_groups', 'district', 'Altstadt', 2023)).toBe(212);
    });
  });
});
