import type { StatisticsRepository } from '../../domains/statistics/ports/statisticsRepository';
import { getDb } from './duckdb';

export function createDuckDbStatisticsRepository(): StatisticsRepository {
  return {
    async getTimeseries(input) {
      const db = await getDb();
      const conn = await db.connect();

      try {
        const params: Array<string | number> = [input.indicator, input.areaType, input.area];
        let sql = `
          SELECT year, value, unit
          FROM statistics
          WHERE indicator = ? AND area_type = ? AND area_name = ?
        `;

        if (input.from !== undefined) {
          sql += ` AND year >= ?`;
          params.push(input.from);
        }
        if (input.to !== undefined) {
          sql += ` AND year <= ?`;
          params.push(input.to);
        }

        sql += ` ORDER BY year ASC`;

        const reader = await conn.runAndReadAll(sql, params);
        const rows = reader.getRows().map((r) => ({
          year: Number(r[0]),
          value: Number(r[1]),
          unit: String(r[2]),
        }));

        return {
          indicator: input.indicator,
          areaType: input.areaType,
          area: input.area,
          rows,
        };
      } finally {
        conn.disconnectSync();
      }
    },

    async listAreas(input) {
      const db = await getDb();
      const conn = await db.connect();

      try {
        const params: string[] = [input.indicator, input.areaType];
        let sql = `
          SELECT DISTINCT area_name
          FROM statistics
          WHERE indicator = ? AND area_type = ?
        `;

        if (input.like) {
          sql += ` AND lower(area_name) LIKE ?`;
          params.push(`%${input.like.toLowerCase()}%`);
        }

        sql += ` ORDER BY area_name ASC`;

        const reader = await conn.runAndReadAll(sql, params);
        const rows = reader.getRows().map((r) => String(r[0]));

        return { indicator: input.indicator, areaType: input.areaType, rows };
      } finally {
        conn.disconnectSync();
      }
    },

    async getRanking(input) {
      const db = await getDb();
      const conn = await db.connect();

      try {
        const reader = await conn.runAndReadAll(
          `
          SELECT area_name, value, unit
          FROM statistics
          WHERE indicator = ? AND area_type = ? AND year = ?
          ORDER BY value ${input.order}
          LIMIT ?
          `,
          [input.indicator, input.areaType, input.year, input.limit],
        );

        const rows = reader.getRows().map((r) => ({
          area: String(r[0]),
          value: Number(r[1]),
          unit: String(r[2]),
        }));

        return {
          indicator: input.indicator,
          areaType: input.areaType,
          year: input.year,
          order: input.order,
          limit: input.limit,
          rows,
        };
      } finally {
        conn.disconnectSync();
      }
    },
  };
}
