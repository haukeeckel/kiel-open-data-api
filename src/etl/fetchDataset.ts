import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { getCacheDir } from '../config/path.js';

import { durationMs, nowMs, type EtlContext } from './etlContext.js';
import { getEtlLogger } from './etlLogger.js';
import { fetchWithRetry } from './fetchWithRetry.js';

import type { DatasetConfig } from './datasets/types.js';

type Meta = {
  etag?: string;
  lastModified?: string;
};

export type FetchDatasetOptions = {
  cacheDir?: string | undefined;
  fetchFn?: typeof fetch | undefined;
};

function metaFilename(csvFilename: string): string {
  if (!csvFilename.endsWith('.csv')) return `${csvFilename}.meta.json`;
  return `${csvFilename.slice(0, -4)}.meta.json`;
}

async function readMeta(
  metaPath: string,
  log: { debug: (obj: unknown, msg: string) => void },
  ctx: EtlContext,
): Promise<Meta> {
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

export async function fetchDataset(
  config: DatasetConfig,
  opts?: FetchDatasetOptions,
): Promise<{ updated: boolean; path: string }> {
  const started = nowMs();
  const { log, ctx } = getEtlLogger('fetch', config.id);

  const cacheDir = opts?.cacheDir ?? getCacheDir();
  const outCsv = path.join(cacheDir, config.csvFilename);
  const outMeta = path.join(cacheDir, metaFilename(config.csvFilename));

  log.info({ ...ctx, url: config.url, out: outCsv }, 'etl.fetch: start');

  await fs.mkdir(cacheDir, { recursive: true });
  const meta = await readMeta(outMeta, log, ctx);

  const headers: Record<string, string> = {};
  if (meta.etag) headers['If-None-Match'] = meta.etag;
  if (meta.lastModified) headers['If-Modified-Since'] = meta.lastModified;

  log.debug({ ...ctx, headers }, 'etl.fetch: request headers');

  const retryOpts = opts?.fetchFn ? { fetchFn: opts.fetchFn } : {};
  const res = await fetchWithRetry(config.url, { headers }, retryOpts);

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
