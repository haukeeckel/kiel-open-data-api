import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  districtsGenderCsvFixture,
  districtsGenderSingleRowCsvFixture,
  districtsMissingRequiredColumnsCsvFixture,
  districtsNoYearColumnsCsvFixture,
  districtsPopulationCommaDelimitedCsvFixture,
  districtsPopulationSingleAreaCsvFixture,
  districtsPopulationSingleYearCsvFixture,
  districtsPopulationSpacedHeadersCsvFixture,
  districtsPopulationCsvFixture,
  districtsUnemployedDateColumnsCsvFixture,
} from '../test/fixtures/etlImport.fixtures.js';
import { withTestEnv } from '../test/helpers/env.js';
import {
  copyDbSnapshot,
  mkTmpDir,
  prepareMigratedDb,
  queryCount,
  queryLatestRun,
  queryValue,
  withConn,
} from '../test/helpers/etlImportDb.js';

import { DISTRICTS_GENDER } from './datasets/districts_gender.js';
import { DISTRICTS_POPULATION } from './datasets/districts_population.js';
import { DISTRICTS_UNEMPLOYED_COUNT } from './datasets/districts_unemployed_count.js';
import * as etlLoggerModule from './etlLogger.js';
import { importDataset } from './importDataset.js';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('importDataset', () => {
  let suiteTmp: string;
  let templateDbPath: string;
  let tmp: string;
  let cacheDir: string;
  let csvPath: string;
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
    csvPath = path.join(cacheDir, DISTRICTS_POPULATION.csvFilename);
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

  it('stores run metadata and lineage columns for successful imports', async () => {
    const csv = districtsPopulationSingleAreaCsvFixture();

    await fs.writeFile(csvPath, csv, 'utf8');
    await importDataset(DISTRICTS_POPULATION, { csvPath, dbPath });

    await withConn(dbPath, async (conn) => {
      const run = await queryLatestRun(conn, DISTRICTS_POPULATION.id);
      expect(run.status).toBe('published');
      expect(run.rowCount).toBe(2);
      expect(run.dataVersion).toMatch(/^size:\d+;mtimeMs:\d+$/);
      expect(run.hasFailedAt).toBe(false);

      const rowReader = await conn.runAndReadAll(
        `
        SELECT source_dataset, import_run_id, loaded_at, data_version
        FROM statistics
        WHERE indicator = 'population'
        ORDER BY year DESC
        LIMIT 1;
        `,
      );
      const row = rowReader.getRowObjects()[0];
      expect(String(row?.['source_dataset'])).toBe(DISTRICTS_POPULATION.id);
      expect(String(row?.['import_run_id'])).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(row?.['loaded_at']).toBeDefined();
      expect(String(row?.['data_version'])).toMatch(/^size:\d+;mtimeMs:\d+$/);
    });
  });

  it('logs ETL step timings and summary on successful import', async () => {
    const csv = districtsPopulationSingleYearCsvFixture();
    await fs.writeFile(csvPath, csv, 'utf8');

    const info = vi.fn();
    const debug = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const child = vi.fn(() => ({ info, debug, warn, error, child }));

    const loggerSpy = vi.spyOn(etlLoggerModule, 'getEtlLogger').mockReturnValue({
      log: { info, debug, warn, error, child } as never,
      ctx: { dataset: DISTRICTS_POPULATION.id, step: 'import' },
    });

    try {
      await importDataset(DISTRICTS_POPULATION, { csvPath, dbPath });

      const stepCalls = info.mock.calls.filter((call) => call[1] === 'etl.import: step done');
      const stepNames = stepCalls.map((call) => String((call[0] as { step?: string }).step));
      expect(stepNames).toEqual(
        expect.arrayContaining([
          'load_csv_temp_table',
          'normalize_headers',
          'transaction_delete_scope',
          'transaction_insert_rows',
        ]),
      );

      const doneCall = info.mock.calls.find((call) => call[1] === 'etl.import: done');
      expect(doneCall).toBeDefined();
      expect(doneCall?.[0]).toMatchObject({
        stepTimings: expect.objectContaining({
          load_csv_temp_table: expect.any(Number),
          normalize_headers: expect.any(Number),
          transaction_delete_scope: expect.any(Number),
          transaction_insert_rows: expect.any(Number),
        }),
      });
    } finally {
      loggerSpy.mockRestore();
    }
  });

  it('logs failure with partial step timings', async () => {
    const csv = districtsPopulationSingleYearCsvFixture();
    await fs.writeFile(csvPath, csv, 'utf8');

    if (DISTRICTS_POPULATION.format.type !== 'unpivot_years') {
      throw new Error('Expected unpivot_years format for DISTRICTS_POPULATION');
    }

    const brokenConfig = {
      ...DISTRICTS_POPULATION,
      format: {
        ...DISTRICTS_POPULATION.format,
        yearParser: () => Number.NaN,
      },
    };

    const info = vi.fn();
    const debug = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const child = vi.fn(() => ({ info, debug, warn, error, child }));

    const loggerSpy = vi.spyOn(etlLoggerModule, 'getEtlLogger').mockReturnValue({
      log: { info, debug, warn, error, child } as never,
      ctx: { dataset: DISTRICTS_POPULATION.id, step: 'import' },
    });

    try {
      await expect(importDataset(brokenConfig, { csvPath, dbPath })).rejects.toThrow(
        /Invalid yearParser output/i,
      );

      const failCall = error.mock.calls.find((call) => call[1] === 'etl.import: failed');
      expect(failCall).toBeDefined();
      expect(failCall?.[0]).toMatchObject({
        stepTimings: expect.objectContaining({
          load_csv_temp_table: expect.any(Number),
          normalize_headers: expect.any(Number),
          transaction_insert_rows: expect.any(Number),
        }),
      });
    } finally {
      loggerSpy.mockRestore();
    }
  });

  it('throws when required columns are missing', async () => {
    const csv = districtsMissingRequiredColumnsCsvFixture();

    await fs.writeFile(csvPath, csv, 'utf8');

    await expect(importDataset(DISTRICTS_POPULATION, { csvPath, dbPath })).rejects.toThrow(
      /Missing required columns.*Merkmal.*Stadtteil/i,
    );
  });

  it('normalizes spaced headers before required column checks', async () => {
    const csv = districtsPopulationSpacedHeadersCsvFixture();

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

  it('fails fast when DB schema was not migrated', async () => {
    const freshDbPath = path.join(cacheDir, 'fresh-not-migrated.duckdb');
    const csv = districtsPopulationSingleAreaCsvFixture();
    await fs.writeFile(csvPath, csv, 'utf8');

    await expect(
      importDataset(DISTRICTS_POPULATION, { csvPath, dbPath: freshDbPath }),
    ).rejects.toThrow(/run "pnpm migrate" before starting the app/i);
  });

  it('imports with csv path containing apostrophe', async () => {
    const specialCsvPath = path.join(cacheDir, "population'o.csv");
    const csv = districtsPopulationSingleAreaCsvFixture();

    await fs.writeFile(specialCsvPath, csv, 'utf8');

    const res = await importDataset(DISTRICTS_POPULATION, { csvPath: specialCsvPath, dbPath });
    expect(res.imported).toBe(2);
  });

  it('throws when no year columns exist', async () => {
    const csv = districtsNoYearColumnsCsvFixture();

    await fs.writeFile(csvPath, csv, 'utf8');

    await expect(importDataset(DISTRICTS_POPULATION, { csvPath, dbPath })).rejects.toThrow(
      /No year columns found/i,
    );
  });

  it('imports dataset with custom csv delimiter', async () => {
    const csv = districtsPopulationCommaDelimitedCsvFixture();

    const commaCsvPath = path.join(cacheDir, 'districts_population_comma.csv');
    await fs.writeFile(commaCsvPath, csv, 'utf8');

    const commaConfig = {
      ...DISTRICTS_POPULATION,
      csvDelimiter: ',',
    };

    const res = await importDataset(commaConfig, { csvPath: commaCsvPath, dbPath });
    expect(res.imported).toBe(4);
  });

  it('throws when csvDelimiter is not a single character', async () => {
    const invalidDelimiterConfig = {
      ...DISTRICTS_POPULATION,
      csvDelimiter: ';;',
    };

    await expect(importDataset(invalidDelimiterConfig, { csvPath, dbPath })).rejects.toThrow(
      /invalid csvDelimiter/i,
    );
  });

  it('throws descriptive error when unpivot_years yearParser returns NaN', async () => {
    const csv = districtsUnemployedDateColumnsCsvFixture();
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
    const csv = districtsGenderSingleRowCsvFixture();
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
    const csv = districtsUnemployedDateColumnsCsvFixture();
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
    const csv = districtsGenderSingleRowCsvFixture();
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

  it('rolls back unpivot_years imports and preserves previous data on failure', async () => {
    const csv = districtsPopulationCsvFixture();

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
          index === 0 ? { ...row, valueExpression: `does_not_exist` } : row,
        ),
      },
    };

    await expect(importDataset(brokenConfig, { csvPath, dbPath })).rejects.toThrow();

    await withConn(dbPath, async (conn) => {
      expect(await queryCount(conn, 'population', 'district', 'total')).toBe(4);
      expect(await queryValue(conn, 'population', 'district', 'Altstadt', 2023)).toBe(1220);
    });
  });

  it('rolls back unpivot_categories imports and preserves previous data on failure', async () => {
    const genderCsv = districtsGenderCsvFixture();

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
          index === 0 ? { ...column, valueExpression: `does_not_exist` } : column,
        ),
      },
    };

    await expect(importDataset(brokenConfig, { csvPath: genderCsvPath, dbPath })).rejects.toThrow();

    await withConn(dbPath, async (conn) => {
      expect(await queryCount(conn, 'gender', 'district', 'total')).toBe(4);
      expect(await queryValue(conn, 'gender', 'district', 'Altstadt', 2023)).toBe(1220);
    });
  });

  it('fails fast when staging import produces zero rows', async () => {
    const csv = districtsPopulationCsvFixture();

    await fs.writeFile(csvPath, csv, 'utf8');

    const first = await importDataset(DISTRICTS_POPULATION, { csvPath, dbPath });
    expect(first.imported).toBe(4);

    if (DISTRICTS_POPULATION.format.type !== 'unpivot_years') {
      throw new Error('Expected unpivot_years format for DISTRICTS_POPULATION');
    }

    const zeroRowsConfig = {
      ...DISTRICTS_POPULATION,
      format: {
        ...DISTRICTS_POPULATION.format,
        rows: DISTRICTS_POPULATION.format.rows.map((row, index) =>
          index === 0 ? { ...row, filterValue: '__not_matching_any_row__' } : row,
        ),
      },
    };

    await expect(importDataset(zeroRowsConfig, { csvPath, dbPath })).rejects.toThrow(
      /produced zero rows.*aborting publish/i,
    );

    await withConn(dbPath, async (conn) => {
      expect(await queryCount(conn, 'population', 'district', 'total')).toBe(4);
      expect(await queryValue(conn, 'population', 'district', 'Altstadt', 2023)).toBe(1220);
      const run = await queryLatestRun(conn, DISTRICTS_POPULATION.id);
      expect(run.status).toBe('failed');
      expect(run.hasFailedAt).toBe(true);
    });
  });
});
