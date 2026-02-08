import Fastify from 'fastify';
import { env } from './env';
import { getDb } from './db';
import z from 'zod';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { badQuery } from './http/validation';
import { getLoggerOptions } from './logger/http';

const TimeseriesQuery = z.object({
  indicator: z.string().min(1),
  areaType: z.string().min(1),
  area: z.string().min(1),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
});

const AreasQuery = z.object({
  indicator: z.string().min(1),
  areaType: z.string().min(1),
  like: z.string().min(1).optional(),
});

const RankingQuery = z.object({
  indicator: z.string().min(1),
  areaType: z.string().min(1),
  year: z.coerce.number().int(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export async function buildServer() {
  const app = Fastify({
    logger: getLoggerOptions(env.NODE_ENV),
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request failed');
    reply.code(500).send({ error: 'Internal Server Error', requestId: req.id });
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'kiel-dashboard-api',
        description: 'Open data API for Kiel dashboard',
        version: '1.0.0',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  app.get('/', async () => {
    return {
      name: 'kiel-dashboard-api',
      endpoints: ['/health'],
    };
  });

  app.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              ts: { type: 'string' },
            },
            required: ['ok', 'ts'],
          },
        },
      },
    },
    async () => ({ ok: true, ts: new Date().toISOString() }),
  );

  app.get('/timeseries', async (req, reply) => {
    const parsed = TimeseriesQuery.safeParse(req.query);
    if (!parsed.success) return badQuery(req, reply, parsed.error);

    const { indicator, areaType, area, from, to } = parsed.data;

    if (!indicator || !areaType || !area) {
      return reply.code(400).send({
        error: 'indicator, areaType and area are required',
      });
    }

    const db = await getDb();
    const conn = await db.connect();

    try {
      const params: Array<string | number> = [indicator, areaType, area];
      let sql = `
      SELECT year, value, unit
      FROM facts
      WHERE indicator = ? AND area_type = ? AND area_name = ?
    `;

      if (from !== undefined && Number.isFinite(from)) {
        sql += ` AND year >= ?`;
        params.push(from);
      }
      if (to !== undefined && Number.isFinite(to)) {
        sql += ` AND year <= ?`;
        params.push(to);
      }

      sql += ` ORDER BY year ASC`;

      const reader = await conn.runAndReadAll(sql, params);
      const rows = reader.getRows().map((r) => ({
        year: Number(r[0]),
        value: Number(r[1]),
        unit: String(r[2]),
      }));

      return { indicator, areaType, area, rows };
    } finally {
      conn.disconnectSync();
    }
  });

  app.get('/areas', async (req, reply) => {
    const parsed = AreasQuery.safeParse(req.query);
    if (!parsed.success) return badQuery(req, reply, parsed.error);

    const { indicator, areaType, like } = parsed.data;

    if (!indicator || !areaType) {
      return reply.code(400).send({ error: 'indicator and areaType are required' });
    }

    const db = await getDb();
    const conn = await db.connect();
    try {
      const params: string[] = [indicator, areaType];
      let sql = `
      SELECT DISTINCT area_name
      FROM facts
      WHERE indicator = ? AND area_type = ?
    `;

      if (like) {
        sql += ` AND lower(area_name) LIKE ?`;
        params.push(`%${like.toLowerCase()}%`);
      }

      sql += ` ORDER BY area_name ASC`;

      const reader = await conn.runAndReadAll(sql, params);
      const rows = reader.getRows().map((r) => String(r[0]));
      return { indicator, areaType, rows };
    } finally {
      conn.disconnectSync();
    }
  });

  app.get('/ranking', async (req, reply) => {
    const parsed = RankingQuery.safeParse(req.query);
    if (!parsed.success) return badQuery(req, reply, parsed.error);

    const { indicator, areaType, year, limit, order } = parsed.data;

    if (!indicator || !areaType || !Number.isFinite(year)) {
      return reply.code(400).send({
        error: 'indicator, areaType and year are required',
      });
    }

    const db = await getDb();
    const conn = await db.connect();

    try {
      const reader = await conn.runAndReadAll(
        `
      SELECT area_name, value, unit
      FROM facts
      WHERE indicator = ? AND area_type = ? AND year = ?
      ORDER BY value ${order}
      LIMIT ?
      `,
        [indicator, areaType, year, limit],
      );

      const rows = reader.getRows().map((r) => ({
        area: String(r[0]),
        value: Number(r[1]),
        unit: String(r[2]),
      }));

      return { indicator, areaType, year, order: order.toLowerCase(), limit, rows };
    } finally {
      conn.disconnectSync();
    }
  });

  app.setNotFoundHandler(async (_req, reply) => {
    return reply.code(404).send({ error: 'Not Found' });
  });
  await app.ready();
  return app;
}

async function main() {
  const app = await buildServer();

  const port = env.PORT;
  const host = env.HOST;

  await app.listen({ port, host });

  const close = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');

    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void close('SIGINT'));
  process.on('SIGTERM', () => void close('SIGTERM'));
}

void main();
