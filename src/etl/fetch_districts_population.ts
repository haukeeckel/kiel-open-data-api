import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getEnv } from '../config/env';
import type { EtlContext } from './etlContext';
import { durationMs, nowMs } from './etlContext';
import { createEtlLogger } from '../logger/etl';
import { getCacheDir } from '../config/path';
import { CSV_FILENAME, CSV_META_FILENAME, DATASET, URL } from './districts_population.constants';
import { fetchWithRetry } from './fetchWithRetry';

const log = createEtlLogger(getEnv().NODE_ENV);
const ctx: EtlContext = { dataset: DATASET, step: 'fetch' };

type Meta = {
  etag?: string;
  lastModified?: string;
};

async function readMeta(metaPath: string): Promise<Meta> {
  try {
    const raw = await fs.readFile(metaPath, 'utf8');
    return JSON.parse(raw) as Meta;
  } catch (err) {
    log.debug({ ...ctx, err }, 'etl.fetch: meta not found or invalid; continuing with empty meta');
    return {};
  }
}

async function writeMeta(metaPath: string, meta: Meta) {
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

export async function fetchDistrictsPopulation(opts?: {
  cacheDir?: string;
  fetchFn?: typeof fetch;
}): Promise<{ updated: boolean; path: string }> {
  const started = nowMs();

  const cacheDir = opts?.cacheDir ?? getCacheDir();
  const outCsv = path.join(cacheDir, CSV_FILENAME);
  const outMeta = path.join(cacheDir, CSV_META_FILENAME);

  log.info({ ...ctx, url: URL, out: outCsv }, 'etl.fetch: start');

  await fs.mkdir(cacheDir, { recursive: true });
  const meta = await readMeta(outMeta);

  const headers: Record<string, string> = {};
  if (meta.etag) headers['If-None-Match'] = meta.etag;
  if (meta.lastModified) headers['If-Modified-Since'] = meta.lastModified;

  log.debug({ ...ctx, headers }, 'etl.fetch: request headers');

  const retryOpts = opts?.fetchFn ? { fetchFn: opts.fetchFn } : {};
  const res = await fetchWithRetry(URL, { headers }, retryOpts);

  log.info(
    {
      ...ctx,
      status: res.status,
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    },
    'etl.fetch: response received',
  );

  if (res.status === 304) {
    log.info({ ...ctx, ms: durationMs(started), path: outCsv }, 'etl.fetch: not modified');
    return { updated: false, path: outCsv };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.error(
      { ...ctx, status: res.status, statusText: res.statusText, body: body.slice(0, 500) },
      'etl.fetch: failed',
    );
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  await fs.writeFile(outCsv, text, 'utf8');

  const bytes = Buffer.byteLength(text, 'utf8');

  const nextMeta: Meta = {};
  const etag = res.headers.get('etag');
  const lastModified = res.headers.get('last-modified');
  if (etag) nextMeta.etag = etag;
  if (lastModified) nextMeta.lastModified = lastModified;

  await writeMeta(outMeta, nextMeta);

  log.info(
    { ...ctx, ms: durationMs(started), path: outCsv, bytes, meta: nextMeta },
    'etl.fetch: wrote cache file',
  );

  return { updated: true, path: outCsv };
}
