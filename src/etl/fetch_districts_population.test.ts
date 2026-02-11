import * as fssync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setTestEnv } from '../test/helpers/env.js';

import { CSV_FILENAME, CSV_META_FILENAME } from './districts_population.constants.js';
import { fetchDistrictsPopulation } from './fetch_districts_population.js';

function mkTmpDir() {
  return fssync.mkdtempSync(path.join(os.tmpdir(), 'kiel-etl-'));
}

describe('fetchDistrictsPopulation', () => {
  let tmp: string;
  let cacheDir: string;

  beforeEach(async () => {
    tmp = mkTmpDir();
    cacheDir = path.join(tmp, 'data', 'cache');

    await fs.mkdir(cacheDir, { recursive: true });

    setTestEnv({ NODE_ENV: 'test' });
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    try {
      fssync.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  it('writes csv and meta on 200 OK', async () => {
    const csv = 'Merkmal;Stadtteil;2023\nEinwohner insgesamt;Altstadt;1220\n';

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(csv, {
          status: 200,
          headers: {
            etag: '"abc"',
            'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
          },
        });
      }),
    );

    const res = await fetchDistrictsPopulation({ cacheDir });

    const outCsv = path.join(cacheDir, CSV_FILENAME);
    const outMeta = path.join(cacheDir, CSV_META_FILENAME);

    expect(res).toEqual({ updated: true, path: outCsv });

    expect(await fs.readFile(outCsv, 'utf8')).toBe(csv);

    const meta = JSON.parse(await fs.readFile(outMeta, 'utf8'));
    expect(meta).toEqual({
      etag: '"abc"',
      lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT',
    });
  });

  it('sends conditional headers and returns updated=false on 304', async () => {
    const outMeta = path.join(cacheDir, CSV_META_FILENAME);
    await fs.writeFile(
      outMeta,
      JSON.stringify({ etag: '"prev"', lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT' }, null, 2),
      'utf8',
    );

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        'If-None-Match': '"prev"',
        'If-Modified-Since': 'Mon, 01 Jan 2024 00:00:00 GMT',
      });

      // 304 Response cannot be constructed in undici -> minimal stub suffices
      return {
        status: 304,
        ok: false, // Doesn't matter, because your code first checks status===304
        statusText: 'Not Modified',
        headers: {
          get: () => null,
        },
      } as unknown as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchDistrictsPopulation({ cacheDir });
    expect(res).toEqual({ updated: false, path: path.join(cacheDir, CSV_FILENAME) });
  });

  it('throws on non-ok response after retries (e.g. 500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500, statusText: 'Internal Server Error' })),
    );

    await expect(fetchDistrictsPopulation({ cacheDir })).rejects.toThrow(/Fetch failed: 500/i);
  }, 10_000);
});
