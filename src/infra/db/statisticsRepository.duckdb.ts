import type { StatisticsRepository } from '../../domains/statistics/ports/statisticsRepository.js';
import type { DuckDBConnection } from '@duckdb/node-api';

function requireValue(row: Record<string, unknown>, key: string): unknown {
  const value = row[key];
  if (value === null || value === undefined) {
    throw new Error(`statistics row missing ${key}`);
  }
  return value;
}

function requireNumber(row: Record<string, unknown>, key: string): number {
  const value = requireValue(row, key);
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`statistics row invalid ${key}`);
  }
  return num;
}

function requireString(row: Record<string, unknown>, key: string): string {
  const value = requireValue(row, key);
  return String(value);
}

export function createDuckDbStatisticsRepository(conn: DuckDBConnection): StatisticsRepository {
  return {
    async getTimeseries(input) {
      const params: Array<string | number> = [input.indicator, input.areaType, input.area];
      let sql = `
        SELECT year, value, unit, category
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND area_name = ?
      `;

      sql += ` AND category = ?`;
      params.push(input.category ?? 'total');

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
      const rows = reader.getRowObjects().map((r) => ({
        year: requireNumber(r, 'year'),
        value: requireNumber(r, 'value'),
        unit: requireString(r, 'unit'),
        category: requireString(r, 'category'),
      }));

      return {
        indicator: input.indicator,
        areaType: input.areaType,
        area: input.area,
        rows,
      };
    },

    async listAreas(input) {
      const params: string[] = [input.indicator, input.areaType];
      let sql = `
        SELECT DISTINCT area_name
        FROM statistics
        WHERE indicator = ? AND area_type = ?
      `;

      sql += ` AND category = ?`;
      params.push(input.category ?? 'total');

      if (input.like) {
        sql += ` AND lower(area_name) LIKE ? ESCAPE '\\'`;
        const escaped = input.like.toLowerCase().replace(/[%_\\]/g, '\\$&');
        params.push(`%${escaped}%`);
      }

      sql += ` ORDER BY area_name ASC`;

      const reader = await conn.runAndReadAll(sql, params);
      const rows = reader.getRowObjects().map((r) => requireString(r, 'area_name'));

      return { indicator: input.indicator, areaType: input.areaType, rows };
    },

    async listCategories(input) {
      const reader = await conn.runAndReadAll(
        `
        SELECT DISTINCT category
        FROM statistics
        WHERE indicator = ? AND area_type = ?
        ORDER BY category ASC
        `,
        [input.indicator, input.areaType],
      );

      const rows = reader.getRowObjects().map((r) => requireString(r, 'category'));
      return { indicator: input.indicator, areaType: input.areaType, rows };
    },

    async getRanking(input) {
      const reader = await conn.runAndReadAll(
        `
        SELECT area_name, value, unit, category
        FROM statistics
        WHERE indicator = ? AND area_type = ? AND year = ? AND category = ?
        ORDER BY value ${input.order === 'asc' ? 'ASC' : 'DESC'}
        LIMIT ?
        `,
        [input.indicator, input.areaType, input.year, input.category ?? 'total', input.limit],
      );

      const rows = reader.getRowObjects().map((r) => ({
        area: requireString(r, 'area_name'),
        value: requireNumber(r, 'value'),
        unit: requireString(r, 'unit'),
        category: requireString(r, 'category'),
      }));

      return {
        indicator: input.indicator,
        areaType: input.areaType,
        year: input.year,
        order: input.order,
        limit: input.limit,
        rows,
      };
    },
  };
}
