import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestEnv } from '../test/helpers/env.js';

import { DISTRICTS_POPULATION } from './datasets/districts_population.js';
import { fetchDataset } from './fetchDataset.js';
import * as fetchWithRetryModule from './fetchWithRetry.js';

vi.mock('../utils/sleep.js', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

function mkTmpDir() {
  return fssync.mkdtempSync(path.join(os.tmpdir(), 'kiel-etl-'));
}

describe('fetchDataset', () => {
  let tmp: string;
  let cacheDir: string;
  let restoreEnv: (() => void) | null = null;

  beforeEach(async () => {
    tmp = mkTmpDir();
    cacheDir = path.join(tmp, 'data', 'cache');
    await fs.mkdir(cacheDir, { recursive: true });

    restoreEnv = withTestEnv({ NODE_ENV: 'test' });
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    restoreEnv?.();
    restoreEnv = null;
    vi.unstubAllGlobals();
    try {
      fssync.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  it('writes csv and meta on 200 OK', async () => {
    const csv = 'Merkmal;Stadtteil;2023\nEinwohner insgesamt;Altstadt;1220\n';
    const catalog = [
      {
        name: 'de-sh-kiel_stadtteile',
        resources: [
          {
            url: 'https://www.kiel.de/de/kiel_zukunft/statistik_kieler_zahlen/open_data/kiel_bevoelkerung_stadtteile.csv',
            format: 'csv',
          },
        ],
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('Kiel_open_data.json')) {
          return new Response(JSON.stringify(catalog), { status: 200 });
        }

        return new Response(csv, {
          status: 200,
          headers: {
            etag: '"abc"',
            'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
          },
        });
      }),
    );

    const res = await fetchDataset(DISTRICTS_POPULATION, { cacheDir });

    const outCsv = path.join(cacheDir, 'kiel_bevoelkerung_stadtteile.csv');
    const outMeta = path.join(cacheDir, 'kiel_bevoelkerung_stadtteile.meta.json');

    expect(res).toEqual({ updated: true, path: outCsv });
    expect(await fs.readFile(outCsv, 'utf8')).toBe(csv);

    const meta = JSON.parse(await fs.readFile(outMeta, 'utf8'));
    expect(meta).toEqual({
      etag: '"abc"',
      lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT',
      kielOpenData: {
        name: 'de-sh-kiel_stadtteile',
        resources: [
          {
            url: 'https://www.kiel.de/de/kiel_zukunft/statistik_kieler_zahlen/open_data/kiel_bevoelkerung_stadtteile.csv',
            format: 'csv',
          },
        ],
      },
    });
  });

  it('sends conditional headers and returns updated=false on 304', async () => {
    const outMeta = path.join(cacheDir, 'kiel_bevoelkerung_stadtteile.meta.json');
    const catalog = [
      {
        name: 'de-sh-kiel_stadtteile',
        resources: [
          {
            url: 'https://www.kiel.de/de/kiel_zukunft/statistik_kieler_zahlen/open_data/kiel_bevoelkerung_stadtteile.csv',
            format: 'csv',
          },
        ],
      },
    ];
    await fs.writeFile(
      outMeta,
      JSON.stringify({ etag: '"prev"', lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT' }, null, 2),
      'utf8',
    );

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('Kiel_open_data.json')) {
        return new Response(JSON.stringify(catalog), { status: 200 });
      }

      expect(init?.headers).toMatchObject({
        'If-None-Match': '"prev"',
        'If-Modified-Since': 'Mon, 01 Jan 2024 00:00:00 GMT',
      });

      return {
        status: 304,
        ok: false,
        statusText: 'Not Modified',
        headers: {
          get: () => null,
        },
      } as unknown as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchDataset(DISTRICTS_POPULATION, { cacheDir });
    expect(res).toEqual({
      updated: false,
      path: path.join(cacheDir, 'kiel_bevoelkerung_stadtteile.csv'),
    });

    const meta = JSON.parse(await fs.readFile(outMeta, 'utf8'));
    expect(meta).toEqual({
      etag: '"prev"',
      lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
      kielOpenData: {
        name: 'de-sh-kiel_stadtteile',
        resources: [
          {
            url: 'https://www.kiel.de/de/kiel_zukunft/statistik_kieler_zahlen/open_data/kiel_bevoelkerung_stadtteile.csv',
            format: 'csv',
          },
        ],
      },
    });
  });

  it('throws on non-ok response after retries (e.g. 500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500, statusText: 'Internal Server Error' })),
    );

    await expect(fetchDataset(DISTRICTS_POPULATION, { cacheDir })).rejects.toThrow(
      /Fetch failed: 500/i,
    );
  }, 10_000);

  it('passes retry and timeout options to fetchWithRetry', async () => {
    const csv = 'Merkmal;Stadtteil;2023\nEinwohner insgesamt;Altstadt;1220\n';
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('Kiel_open_data.json')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(csv, { status: 200 });
    });
    const spy = vi.spyOn(fetchWithRetryModule, 'fetchWithRetry');

    await fetchDataset(DISTRICTS_POPULATION, {
      cacheDir,
      fetchFn,
      retries: 7,
      baseDelayMs: 11,
      maxDelayMs: 12,
      timeoutMs: 13,
    });

    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      const opts = call[2];
      expect(opts).toMatchObject({
        fetchFn,
        retries: 7,
        baseDelayMs: 11,
        maxDelayMs: 12,
        timeoutMs: 13,
      });
    }
  });

  it('fails cleanly when target csv path is invalid for atomic write', async () => {
    const csv = 'Merkmal;Stadtteil;2023\nEinwohner insgesamt;Altstadt;1220\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(csv, { status: 200 })),
    );

    const nestedConfig = {
      ...DISTRICTS_POPULATION,
      csvFilename: 'nested/invalid-path.csv',
    };
    const outCsv = path.join(cacheDir, nestedConfig.csvFilename);
    const outCsvTmp = `${outCsv}.tmp`;

    await expect(fetchDataset(nestedConfig, { cacheDir })).rejects.toThrow();
    expect(fssync.existsSync(outCsv)).toBe(false);
    expect(fssync.existsSync(outCsvTmp)).toBe(false);
  });
});
