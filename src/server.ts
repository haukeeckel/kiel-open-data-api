import Fastify from 'fastify';
import { env } from './env';
import { getDb } from './db';
import { z } from 'zod';

const TimeseriesQuery = z.object({
  indicator: z.string().min(1),
  areaType: z.string().min(1),
  area: z.string().min(1),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
});

export function buildServer() {
  const isProd = process.env.NODE_ENV === 'production';

  const app = Fastify({
    logger: isProd
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        },
  });

  app.get('/', async () => {
    return {
      name: 'kiel-dashboard-api',
      endpoints: ['/health'],
    };
  });

  app.get('/health', async () => {
    return { ok: true, ts: new Date().toISOString() };
  });

  app.get('/db-test', async () => {
    const db = await getDb();
    const conn = await db.connect();

    try {
      const reader = await conn.runAndReadAll('SELECT 42 AS answer');
      return { rows: reader.getRowObjects() };
    } finally {
      conn.disconnectSync();
    }
  });

  app.get('/timeseries', async (req, reply) => {
    const parsed = TimeseriesQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Invalid query parameters', details: parsed.error.message });
    }

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

  app.setNotFoundHandler(async (_req, reply) => {
    return reply.code(404).send({ error: 'Not Found' });
  });

  return app;
}

async function main() {
  const app = buildServer();

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
