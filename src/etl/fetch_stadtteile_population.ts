import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const URL =
  'https://www.kiel.de/de/kiel_zukunft/statistik_kieler_zahlen/open_data/kiel_bevoelkerung_stadtteile.csv';

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
  } catch {
    // error logging?
    return {};
  }
}

async function writeMeta(meta: Meta) {
  await fs.writeFile(OUT_META, JSON.stringify(meta, null, 2), 'utf8');
}

export async function fetchStadtteilePopulation(): Promise<{
  updated: boolean;
  path: string;
}> {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const meta = await readMeta();

  const headers: Record<string, string> = {};
  if (meta.etag) headers['If-None-Match'] = meta.etag;
  if (meta.lastModified) headers['If-Modified-Since'] = meta.lastModified;

  const res = await fetch(URL, { headers });

  if (res.status === 304) {
    return { updated: false, path: OUT_CSV };
  }

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  await fs.writeFile(OUT_CSV, text, 'utf8');

  const nextMeta: Meta = {};
  const etag = res.headers.get('etag');
  const lastModified = res.headers.get('last-modified');

  if (etag) nextMeta.etag = etag;
  if (lastModified) nextMeta.lastModified = lastModified;

  await writeMeta(nextMeta);

  return { updated: true, path: OUT_CSV };
}

async function main() {
  const result = await fetchStadtteilePopulation();
  console.log(result.updated ? `Fetched: ${result.path}` : `Not modified: ${result.path}`);
}

void main();
