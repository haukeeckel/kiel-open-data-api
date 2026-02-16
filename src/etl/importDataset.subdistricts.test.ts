import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  postalCodePopulationCsvWithHeaderAliasFixture,
  subdistrictAgeGroupsCsvFixture,
  subdistrictForeignGenderCsvFixture,
  subdistrictGenderCsvFixture,
  subdistrictMigrantGenderCsvFixture,
  subdistrictPopulationCsvFixture,
} from '../test/fixtures/etlImport.fixtures.js';
import { withTestEnv } from '../test/helpers/env.js';
import {
  copyDbSnapshot,
  mkTmpDir,
  prepareMigratedDb,
  withConn,
} from '../test/helpers/etlImportDb.js';

import { POSTAL_CODES_POPULATION } from './datasets/postal_codes_population.js';
import { SUBDISTRICTS_AGE_GROUPS } from './datasets/subdistricts_age_groups.js';
import { SUBDISTRICTS_FOREIGN_GENDER } from './datasets/subdistricts_foreign_gender.js';
import { SUBDISTRICTS_GENDER } from './datasets/subdistricts_gender.js';
import { SUBDISTRICTS_MIGRANT_GENDER } from './datasets/subdistricts_migrant_gender.js';
import { SUBDISTRICTS_POPULATION } from './datasets/subdistricts_population.js';
import { importDataset } from './importDataset.js';

describe('importDataset (subdistrict and postal_code)', () => {
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

  it('imports subdistrict population and keeps last duplicate year column', async () => {
    const subdistrictCsvPath = path.join(cacheDir, SUBDISTRICTS_POPULATION.csvFilename);
    const csv = subdistrictPopulationCsvFixture();
    await fs.writeFile(subdistrictCsvPath, csv, 'utf8');

    const first = await importDataset(SUBDISTRICTS_POPULATION, {
      csvPath: subdistrictCsvPath,
      dbPath,
    });
    const second = await importDataset(SUBDISTRICTS_POPULATION, {
      csvPath: subdistrictCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(4);
    expect(second.imported).toBe(4);

    await withConn(dbPath, async (conn) => {
      const rowsReader = await conn.runAndReadAll(
        `
        SELECT area_type, area_name, year, value, category
        FROM statistics
        WHERE indicator = 'population' AND area_type = 'subdistrict'
        ORDER BY area_name ASC, year ASC;
        `,
      );
      const rows = rowsReader.getRowObjects();
      expect(rows).toHaveLength(4);
      expect(rows).toEqual([
        {
          area_type: 'subdistrict',
          area_name: 'Pries/Friedrichsort',
          year: 2022,
          value: 9743,
          category: 'total',
        },
        {
          area_type: 'subdistrict',
          area_name: 'Pries/Friedrichsort',
          year: 2023,
          value: 9800,
          category: 'total',
        },
        {
          area_type: 'subdistrict',
          area_name: 'Schilksee',
          year: 2022,
          value: 4857,
          category: 'total',
        },
        {
          area_type: 'subdistrict',
          area_name: 'Schilksee',
          year: 2023,
          value: 4900,
          category: 'total',
        },
      ]);
    });
  });

  it('imports subdistrict age groups with total, parsed years, and trimmed area names', async () => {
    const subdistrictCsvPath = path.join(cacheDir, SUBDISTRICTS_AGE_GROUPS.csvFilename);
    const csv = subdistrictAgeGroupsCsvFixture();
    await fs.writeFile(subdistrictCsvPath, csv, 'utf8');

    const first = await importDataset(SUBDISTRICTS_AGE_GROUPS, {
      csvPath: subdistrictCsvPath,
      dbPath,
    });
    const second = await importDataset(SUBDISTRICTS_AGE_GROUPS, {
      csvPath: subdistrictCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(76);
    expect(second.imported).toBe(76);

    await withConn(dbPath, async (conn) => {
      const categoriesReader = await conn.runAndReadAll(
        `
        SELECT category
        FROM statistics
        WHERE indicator = 'age_groups' AND area_type = 'subdistrict'
        GROUP BY category
        ORDER BY category ASC;
        `,
      );
      const categories = categoriesReader.getRowObjects().map((row) => String(row['category']));
      expect(categories).toEqual([
        'age_0_4',
        'age_10_14',
        'age_15_19',
        'age_20_24',
        'age_25_29',
        'age_30_34',
        'age_35_39',
        'age_40_44',
        'age_45_49',
        'age_50_54',
        'age_55_59',
        'age_5_9',
        'age_60_64',
        'age_65_69',
        'age_70_74',
        'age_75_79',
        'age_80_84',
        'age_85_plus',
        'total',
      ]);

      const rowsReader = await conn.runAndReadAll(
        `
        SELECT area_name, year, category, value
        FROM statistics
        WHERE indicator = 'age_groups' AND area_type = 'subdistrict'
        ORDER BY area_name ASC, year ASC, category ASC;
        `,
      );
      const rows = rowsReader.getRowObjects();
      expect(rows).toHaveLength(76);

      const schilkseeTotal2023 = rows.find(
        (row) =>
          String(row['area_name']) === 'Schilksee' &&
          Number(row['year']) === 2023 &&
          String(row['category']) === 'total',
      );
      expect(Number(schilkseeTotal2023?.['value'])).toBe(4857);

      const schilkseeChild2023 = rows.find(
        (row) =>
          String(row['area_name']) === 'Schilksee' &&
          Number(row['year']) === 2023 &&
          String(row['category']) === 'age_0_4',
      );
      expect(Number(schilkseeChild2023?.['value'])).toBe(144);

      const years = Array.from(
        new Set(
          rows
            .filter((row) => String(row['area_name']) === 'Pries/Friedrichsort')
            .map((row) => Number(row['year'])),
        ),
      ).sort((a, b) => a - b);
      expect(years).toEqual([2022, 2023]);
    });
  });

  it('imports subdistrict gender categories with dedupe and trimmed area names', async () => {
    const subdistrictCsvPath = path.join(cacheDir, SUBDISTRICTS_GENDER.csvFilename);
    const csv = subdistrictGenderCsvFixture();
    await fs.writeFile(subdistrictCsvPath, csv, 'utf8');

    const first = await importDataset(SUBDISTRICTS_GENDER, { csvPath: subdistrictCsvPath, dbPath });
    const second = await importDataset(SUBDISTRICTS_GENDER, {
      csvPath: subdistrictCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(12);
    expect(second.imported).toBe(12);

    await withConn(dbPath, async (conn) => {
      const categoriesReader = await conn.runAndReadAll(
        `
        SELECT category
        FROM statistics
        WHERE indicator = 'gender' AND area_type = 'subdistrict'
        GROUP BY category
        ORDER BY category ASC;
        `,
      );
      const categories = categoriesReader.getRowObjects().map((row) => String(row['category']));
      expect(categories).toEqual(['female', 'male', 'total']);

      const yearsReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT year
        FROM statistics
        WHERE indicator = 'gender' AND area_type = 'subdistrict'
        ORDER BY year ASC;
        `,
      );
      const years = yearsReader.getRowObjects().map((row) => Number(row['year']));
      expect(years).toEqual([2022, 2023]);

      const areasReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT area_name
        FROM statistics
        WHERE indicator = 'gender' AND area_type = 'subdistrict'
        ORDER BY area_name ASC;
        `,
      );
      const areas = areasReader.getRowObjects().map((row) => String(row['area_name']));
      expect(areas).toEqual(['Pries/Friedrichsort', 'Schilksee']);

      const valueReader = await conn.runAndReadAll(
        `
        SELECT value
        FROM statistics
        WHERE indicator = 'gender'
          AND area_type = 'subdistrict'
          AND area_name = 'Schilksee'
          AND year = 2023
          AND category = 'total';
        `,
      );
      expect(Number(valueReader.getRowObjects()[0]?.['value'])).toBe(4858);
    });
  });

  it('imports subdistrict foreign gender categories with dedupe and trimmed area names', async () => {
    const subdistrictCsvPath = path.join(cacheDir, SUBDISTRICTS_FOREIGN_GENDER.csvFilename);
    const csv = subdistrictForeignGenderCsvFixture();
    await fs.writeFile(subdistrictCsvPath, csv, 'utf8');

    const first = await importDataset(SUBDISTRICTS_FOREIGN_GENDER, {
      csvPath: subdistrictCsvPath,
      dbPath,
    });
    const second = await importDataset(SUBDISTRICTS_FOREIGN_GENDER, {
      csvPath: subdistrictCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(12);
    expect(second.imported).toBe(12);

    await withConn(dbPath, async (conn) => {
      const categoriesReader = await conn.runAndReadAll(
        `
        SELECT category
        FROM statistics
        WHERE indicator = 'foreign_gender' AND area_type = 'subdistrict'
        GROUP BY category
        ORDER BY category ASC;
        `,
      );
      const categories = categoriesReader.getRowObjects().map((row) => String(row['category']));
      expect(categories).toEqual(['female', 'male', 'total']);

      const yearsReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT year
        FROM statistics
        WHERE indicator = 'foreign_gender' AND area_type = 'subdistrict'
        ORDER BY year ASC;
        `,
      );
      const years = yearsReader.getRowObjects().map((row) => Number(row['year']));
      expect(years).toEqual([2022, 2023]);

      const areasReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT area_name
        FROM statistics
        WHERE indicator = 'foreign_gender' AND area_type = 'subdistrict'
        ORDER BY area_name ASC;
        `,
      );
      const areas = areasReader.getRowObjects().map((row) => String(row['area_name']));
      expect(areas).toEqual(['Pries/Friedrichsort', 'Schilksee']);

      const valueReader = await conn.runAndReadAll(
        `
        SELECT value
        FROM statistics
        WHERE indicator = 'foreign_gender'
          AND area_type = 'subdistrict'
          AND area_name = 'Schilksee'
          AND year = 2023
          AND category = 'total';
        `,
      );
      expect(Number(valueReader.getRowObjects()[0]?.['value'])).toBe(202);
    });
  });

  it('imports subdistrict migrant gender categories with dedupe and trimmed area names', async () => {
    const subdistrictCsvPath = path.join(cacheDir, SUBDISTRICTS_MIGRANT_GENDER.csvFilename);
    const csv = subdistrictMigrantGenderCsvFixture();
    await fs.writeFile(subdistrictCsvPath, csv, 'utf8');

    const first = await importDataset(SUBDISTRICTS_MIGRANT_GENDER, {
      csvPath: subdistrictCsvPath,
      dbPath,
    });
    const second = await importDataset(SUBDISTRICTS_MIGRANT_GENDER, {
      csvPath: subdistrictCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(12);
    expect(second.imported).toBe(12);

    await withConn(dbPath, async (conn) => {
      const categoriesReader = await conn.runAndReadAll(
        `
        SELECT category
        FROM statistics
        WHERE indicator = 'migrant_gender' AND area_type = 'subdistrict'
        GROUP BY category
        ORDER BY category ASC;
        `,
      );
      const categories = categoriesReader.getRowObjects().map((row) => String(row['category']));
      expect(categories).toEqual(['female', 'male', 'total']);

      const yearsReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT year
        FROM statistics
        WHERE indicator = 'migrant_gender' AND area_type = 'subdistrict'
        ORDER BY year ASC;
        `,
      );
      const years = yearsReader.getRowObjects().map((row) => Number(row['year']));
      expect(years).toEqual([2022, 2023]);

      const areasReader = await conn.runAndReadAll(
        `
        SELECT DISTINCT area_name
        FROM statistics
        WHERE indicator = 'migrant_gender' AND area_type = 'subdistrict'
        ORDER BY area_name ASC;
        `,
      );
      const areas = areasReader.getRowObjects().map((row) => String(row['area_name']));
      expect(areas).toEqual(['Pries/Friedrichsort', 'Schilksee']);

      const valueReader = await conn.runAndReadAll(
        `
        SELECT value
        FROM statistics
        WHERE indicator = 'migrant_gender'
          AND area_type = 'subdistrict'
          AND area_name = 'Schilksee'
          AND year = 2023
          AND category = 'total';
        `,
      );
      expect(Number(valueReader.getRowObjects()[0]?.['value'])).toBe(902);
    });
  });

  it('imports postal code population with header alias and thousand separators', async () => {
    const postalCsvPath = path.join(cacheDir, POSTAL_CODES_POPULATION.csvFilename);
    const csv = postalCodePopulationCsvWithHeaderAliasFixture();
    await fs.writeFile(postalCsvPath, csv, 'utf8');

    const first = await importDataset(POSTAL_CODES_POPULATION, {
      csvPath: postalCsvPath,
      dbPath,
    });
    const second = await importDataset(POSTAL_CODES_POPULATION, {
      csvPath: postalCsvPath,
      dbPath,
    });

    expect(first.imported).toBe(4);
    expect(second.imported).toBe(4);

    await withConn(dbPath, async (conn) => {
      const rowsReader = await conn.runAndReadAll(
        `
        SELECT area_type, area_name, year, category, value
        FROM statistics
        WHERE indicator = 'population' AND area_type = 'postal_code'
        ORDER BY area_name ASC, year ASC;
        `,
      );
      const rows = rowsReader.getRowObjects();
      expect(rows).toEqual([
        {
          area_type: 'postal_code',
          area_name: '24103',
          year: 2000,
          category: 'total',
          value: 10141,
        },
        {
          area_type: 'postal_code',
          area_name: '24103',
          year: 2023,
          category: 'total',
          value: 12333,
        },
        {
          area_type: 'postal_code',
          area_name: '24105',
          year: 2000,
          category: 'total',
          value: 19466,
        },
        {
          area_type: 'postal_code',
          area_name: '24105',
          year: 2023,
          category: 'total',
          value: 20815,
        },
      ]);
    });
  });
});
