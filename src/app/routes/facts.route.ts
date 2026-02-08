import type { FastifyInstance } from 'fastify';
import { getDb } from '../../db';
import { badQuery } from '../http/validation';
import { AreasQuery, RankingQuery, TimeseriesQuery } from '../../schemas/facts';

export async function registerFactsRoutes(app: FastifyInstance) {
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
}
