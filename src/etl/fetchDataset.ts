import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { getCacheDir } from '../config/path.js';

import { durationMs, nowMs, type EtlContext } from './etlContext.js';
import { getEtlLogger } from './etlLogger.js';
import { fetchWithRetry } from './fetchWithRetry.js';

import type { DatasetConfig } from './datasets/types.js';
import type { FetchRetryOptions } from './fetchWithRetry.js';

type Meta = {
  etag?: string;
  lastModified?: string;
  kielOpenData?: Record<string, unknown>;
};

export type FetchDatasetOptions = {
  cacheDir?: string | undefined;
  retries?: number | undefined;
  baseDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
  timeoutMs?: number | undefined;
  fetchFn?: typeof fetch | undefined;
};

const KIEL_OPEN_DATA_URL = 'https://www.kiel.de/opendata/Kiel_open_data.json';

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
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? (err as { code?: unknown }).code
        : undefined;

    if (code === 'ENOENT') {
      log.debug({ ...ctx, metaPath }, 'etl.fetch: meta not found; continuing with empty meta');
      return {};
    }

    log.debug({ ...ctx, err, metaPath }, 'etl.fetch: meta invalid; continuing with empty meta');
    return {};
  }
}

async function writeMeta(metaPath: string, meta: Meta) {
  await writeFileAtomic(metaPath, JSON.stringify(meta, null, 2));
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  try {
    await fs.writeFile(tmpPath, content, 'utf8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    try {
      await fs.unlink(tmpPath);
    } catch {}
    throw err;
  }
}

function getRetryOptions(opts?: FetchDatasetOptions): FetchRetryOptions {
  const retryOptions: FetchRetryOptions = {};
  if (opts?.fetchFn) retryOptions.fetchFn = opts.fetchFn;
  if (opts?.retries !== undefined) retryOptions.retries = opts.retries;
  if (opts?.baseDelayMs !== undefined) retryOptions.baseDelayMs = opts.baseDelayMs;
  if (opts?.maxDelayMs !== undefined) retryOptions.maxDelayMs = opts.maxDelayMs;
  if (opts?.timeoutMs !== undefined) retryOptions.timeoutMs = opts.timeoutMs;
  return retryOptions;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function fileNameFromUrl(url: string): string {
  const cleaned = normalizeUrl(url);
  const withoutQuery = cleaned.split('?')[0]?.split('#')[0] ?? cleaned;
  const parts = withoutQuery.split('/');
  return parts[parts.length - 1] ?? '';
}

function parseCatalogEntries(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
    );
  }
  if (typeof raw !== 'object' || raw === null) return [];

  const maybeResult = (raw as { result?: unknown }).result;
  if (!Array.isArray(maybeResult)) return [];
  return maybeResult.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  );
}

function hasMatchingResourceUrl(entry: Record<string, unknown>, datasetUrl: string): boolean {
  const resources = entry['resources'];
  if (!Array.isArray(resources)) return false;

  const target = normalizeUrl(datasetUrl);
  const targetFile = fileNameFromUrl(datasetUrl);
  return resources.some((res) => {
    if (typeof res !== 'object' || res === null || Array.isArray(res)) return false;
    const url = (res as { url?: unknown }).url;
    if (typeof url !== 'string') return false;
    const normalized = normalizeUrl(url);
    if (normalized === target) return true;
    return targetFile.length > 0 && fileNameFromUrl(normalized) === targetFile;
  });
}

async function fetchKielOpenDataEntry(args: {
  datasetUrl: string;
  retryOptions: ReturnType<typeof getRetryOptions>;
  log: ReturnType<typeof getEtlLogger>['log'];
  ctx: EtlContext;
}): Promise<Record<string, unknown> | undefined> {
  const { datasetUrl, retryOptions, log, ctx } = args;

  try {
    const res = await fetchWithRetry(KIEL_OPEN_DATA_URL, {}, retryOptions);
    if (!res.ok) {
      log.debug(
        { ...ctx, status: res.status, statusText: res.statusText },
        'etl.fetch: failed to fetch Kiel_open_data.json',
      );
      return undefined;
    }

    const raw = (await res.json()) as unknown;
    const entries = parseCatalogEntries(raw);
    const match = entries.find((entry) => hasMatchingResourceUrl(entry, datasetUrl));

    if (!match) {
      log.debug({ ...ctx, datasetUrl }, 'etl.fetch: no matching dataset entry in Kiel_open_data');
      return undefined;
    }

    return match;
  } catch (err) {
    log.debug({ ...ctx, err }, 'etl.fetch: could not enrich meta from Kiel_open_data');
    return undefined;
  }
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

  const retryOpts = getRetryOptions(opts);
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
    if (meta.kielOpenData === undefined) {
      const kielOpenData = await fetchKielOpenDataEntry({
        datasetUrl: config.url,
        retryOptions: retryOpts,
        log,
        ctx,
      });
      if (kielOpenData) {
        const nextMeta: Meta = { ...meta, kielOpenData };
        await writeMeta(outMeta, nextMeta);
      }
    }
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
  await writeFileAtomic(outCsv, text);

  const bytes = Buffer.byteLength(text, 'utf8');
  const nextMeta: Meta = {};
  const etag = res.headers.get('etag');
  const lastModified = res.headers.get('last-modified');
  if (etag) nextMeta.etag = etag;
  if (lastModified) nextMeta.lastModified = lastModified;
  const kielOpenData = await fetchKielOpenDataEntry({
    datasetUrl: config.url,
    retryOptions: retryOpts,
    log,
    ctx,
  });
  if (kielOpenData) nextMeta.kielOpenData = kielOpenData;

  await writeMeta(outMeta, nextMeta);

  log.info(
    { ...ctx, ms: durationMs(started), path: outCsv, bytes, meta: nextMeta },
    'etl.fetch: wrote cache file',
  );

  return { updated: true, path: outCsv };
}
