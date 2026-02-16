import crypto from 'node:crypto';

import fp from 'fastify-plugin';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const JSON_CONTENT_TYPE = 'application/json';
const CACHE_CONTROL_VALUE = 'public, max-age=60';

function isV1GetRequest(req: FastifyRequest): boolean {
  if (req.method !== 'GET') return false;
  const url = req.raw.url ?? req.url;
  return url.startsWith('/v1/');
}

function isJsonResponse(reply: FastifyReply): boolean {
  const contentType = String(reply.getHeader('content-type') ?? '').toLowerCase();
  return contentType.includes(JSON_CONTENT_TYPE);
}

function hashPayload(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function quoteEtag(value: string): string {
  return `"${value}"`;
}

function normalizeEtagValue(value: string): string {
  let v = value.trim();
  if (v.toUpperCase().startsWith('W/')) {
    v = v.slice(2).trim();
  }
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    v = v.slice(1, -1);
  }
  return v;
}

function ifNoneMatchMatches(ifNoneMatch: string | undefined, currentEtag: string): boolean {
  if (ifNoneMatch === undefined) return false;
  const normalizedCurrent = normalizeEtagValue(currentEtag);
  return ifNoneMatch.split(',').some((raw) => {
    const token = raw.trim();
    if (token === '*') return true;
    return normalizeEtagValue(token) === normalizedCurrent;
  });
}

function payloadToString(payload: unknown): string | null {
  if (typeof payload === 'string') return payload;
  if (Buffer.isBuffer(payload)) return payload.toString('utf8');
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'object') return JSON.stringify(payload);
  return null;
}

export default fp(async function httpCachePlugin(app: FastifyInstance) {
  app.addHook('onSend', async (req, reply, payload) => {
    if (!isV1GetRequest(req)) return payload;
    if (reply.statusCode !== 200) return payload;
    if (!isJsonResponse(reply)) return payload;

    const payloadString = payloadToString(payload);
    if (payloadString === null) return payload;

    const etag = quoteEtag(hashPayload(payloadString));
    const freshness = await app.repos.statisticsRepository.getFreshnessMeta();

    reply.header('ETag', etag);
    reply.header('Cache-Control', CACHE_CONTROL_VALUE);
    reply.header('Data-Version', freshness.dataVersion);
    if (freshness.lastUpdatedAt !== null) {
      reply.header('Last-Updated-At', freshness.lastUpdatedAt);
    }

    const ifNoneMatch = req.headers['if-none-match'];
    const ifNoneMatchValue = typeof ifNoneMatch === 'string' ? ifNoneMatch : undefined;

    if (ifNoneMatchMatches(ifNoneMatchValue, etag)) {
      reply.code(304);
      return '';
    }

    return payload;
  });
});
