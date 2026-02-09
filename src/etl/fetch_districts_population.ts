import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getEnv } from '../config/env';
import type { EtlContext } from './etlContext';
import { durationMs, nowMs } from './etlContext';
import { createEtlLogger } from '../logger/etl';
import { flushLogger } from '../logger/flush';

const log = createEtlLogger(getEnv().NODE_ENV);

const URL =
  'https://www.kiel.de/de/kiel_zukunft/statistik_kieler_zahlen/open_data/kiel_bevoelkerung_stadtteile.csv';
const DATASET = 'districts_population';
const ctx: EtlContext = { dataset: DATASET, step: 'fetch' };

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const OUT_CSV = path.join(CACHE_DIR, 'kiel_bevoelkerung_stadtteile.csv');
const OUT_META = path.join(CACHE_DIR, 'kiel_bevoelkerung_stadtteile.meta.json');

type Meta = {
  etag?: string;
  lastModified?: string;
};

async function readMeta(): Promise<Meta> {
  try {
    const raw = await fs.readFile(OUT_META, 'utf8');
    return JSON.parse(raw) as Meta;
  } catch (err) {
    log.debug({ ...ctx, err }, 'etl.fetch: meta not found or invalid; continuing with empty meta');
    return {};
  }
}

async function writeMeta(meta: Meta) {
  await fs.writeFile(OUT_META, JSON.stringify(meta, null, 2), 'utf8');
}

export async function fetchDistrictsPopulation(): Promise<{ updated: boolean; path: string }> {
  const started = nowMs();
  log.info({ ...ctx, url: URL, out: OUT_CSV }, 'etl.fetch: start');

  await fs.mkdir(CACHE_DIR, { recursive: true });
  const meta = await readMeta();

  const headers: Record<string, string> = {};
  if (meta.etag) headers['If-None-Match'] = meta.etag;
  if (meta.lastModified) headers['If-Modified-Since'] = meta.lastModified;

  log.debug({ ...ctx, headers }, 'etl.fetch: request headers');

  const res = await fetch(URL, { headers });

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
    log.info({ ...ctx, ms: durationMs(started), path: OUT_CSV }, 'etl.fetch: not modified');
    return { updated: false, path: OUT_CSV };
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
  await fs.writeFile(OUT_CSV, text, 'utf8');

  const bytes = Buffer.byteLength(text, 'utf8');

  const nextMeta: Meta = {};
  const etag = res.headers.get('etag');
  const lastModified = res.headers.get('last-modified');
  if (etag) nextMeta.etag = etag;
  if (lastModified) nextMeta.lastModified = lastModified;
  await writeMeta(nextMeta);

  log.info(
    { ...ctx, ms: durationMs(started), path: OUT_CSV, bytes, meta: nextMeta },
    'etl.fetch: wrote cache file',
  );

  return { updated: true, path: OUT_CSV };
}

async function main() {
  try {
    const result = await fetchDistrictsPopulation();
    log.info({ ...ctx, ...result }, 'etl.fetch: done');
  } catch (err) {
    log.error({ ...ctx, err }, 'etl.fetch: fatal');
    process.exitCode = 1;
  } finally {
    // ensure logs are flushed
    await flushLogger(log);
  }
}

void main();
