import { RepositoryInfraError, RepositoryQueryTimeoutError } from './errors.js';

import type { DuckDbConnectionManager } from './duckdbConnectionManager.js';
import type { StatisticsRepository } from '../../domains/statistics/ports/statisticsRepository.js';
import type { DuckDBConnection, DuckDBResultReader } from '@duckdb/node-api';
import type { Logger } from 'pino';

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
  if (typeof value !== 'string') {
    throw new Error(`statistics row invalid ${key}: expected string`);
  }
  return value;
}

type RepositoryLogger = Pick<Logger, 'warn'>;

type CreateRepositoryOptions = {
  queryTimeoutMs: number;
  logger?: RepositoryLogger;
};

type QueryArgs = {
  conn: DuckDBConnection;
  operation: string;
  sql: string;
  values?: Array<string | number>;
  queryTimeoutMs: number;
  logger: RepositoryLogger | undefined;
};

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function summarizeValues(values?: Array<string | number>): string {
  if (!values) return '[]';
  return `[${values.map((v) => (typeof v === 'string' ? '<str>' : String(v))).join(', ')}]`;
}

async function runQueryWithTimeout(args: QueryArgs): Promise<DuckDBResultReader> {
  const { conn, operation, sql, values, queryTimeoutMs, logger } = args;
  let timeout: NodeJS.Timeout | undefined;

  try {
    const queryPromise = conn.runAndReadAll(sql, values);
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        try {
          conn.interrupt();
        } catch {}
        reject(new RepositoryQueryTimeoutError({ operation, timeoutMs: queryTimeoutMs }));
      }, queryTimeoutMs);
    });
    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (err) {
    if (err instanceof RepositoryQueryTimeoutError) {
      logger?.warn?.(
        { operation, timeoutMs: queryTimeoutMs, values: summarizeValues(values) },
        'repository query timed out',
      );
      throw err;
    }
    const wrapped = new RepositoryInfraError({
      operation,
      message: `Repository operation failed: ${operation}`,
      cause: err,
    });
    logger?.warn?.(
      { operation, values: summarizeValues(values), err: toError(err) },
      'repository query failed',
    );
    throw wrapped;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function withRepositoryError<T>(
  operation: string,
  fn: () => Promise<T>,
  logger?: RepositoryLogger,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof RepositoryInfraError) throw err;
    const wrapped = new RepositoryInfraError({
      operation,
      message: `Repository operation failed: ${operation}`,
      cause: err,
    });
    logger?.warn?.({ operation, err: toError(err) }, 'repository operation failed');
    throw wrapped;
  }
}

export function createDuckDbStatisticsRepository(
  manager: DuckDbConnectionManager,
  options: CreateRepositoryOptions,
): StatisticsRepository {
  const queryTimeoutMs = options.queryTimeoutMs;
  const logger = options.logger;

  return {
    async getTimeseries(input) {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.getTimeseries',
          async () => {
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

            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getTimeseries',
              sql,
              values: params,
              queryTimeoutMs,
              logger,
            });
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
          logger,
        ),
      );
    },

    async listAreas(input) {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.listAreas',
          async () => {
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

            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.listAreas',
              sql,
              values: params,
              queryTimeoutMs,
              logger,
            });
            const rows = reader.getRowObjects().map((r) => requireString(r, 'area_name'));

            return { indicator: input.indicator, areaType: input.areaType, rows };
          },
          logger,
        ),
      );
    },

    async listCategories(input) {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.listCategories',
          async () => {
            const sql = `
          SELECT DISTINCT category
          FROM statistics
          WHERE indicator = ? AND area_type = ?
          ORDER BY category ASC
          `;
            const values = [input.indicator, input.areaType];
            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.listCategories',
              sql,
              values,
              queryTimeoutMs,
              logger,
            });
            const rows = reader.getRowObjects().map((r) => requireString(r, 'category'));
            return { indicator: input.indicator, areaType: input.areaType, rows };
          },
          logger,
        ),
      );
    },

    async getRanking(input) {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.getRanking',
          async () => {
            const sql = `
          SELECT area_name, value, unit, category
          FROM statistics
          WHERE indicator = ? AND area_type = ? AND year = ? AND category = ?
          ORDER BY value ${input.order === 'asc' ? 'ASC' : 'DESC'}
          LIMIT ?
          `;
            const values = [
              input.indicator,
              input.areaType,
              input.year,
              input.category ?? 'total',
              input.limit,
            ];
            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getRanking',
              sql,
              values,
              queryTimeoutMs,
              logger,
            });
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
          logger,
        ),
      );
    },

    async listIndicators() {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.listIndicators',
          async () => {
            const sql = `SELECT DISTINCT indicator FROM statistics ORDER BY indicator ASC`;
            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.listIndicators',
              sql,
              queryTimeoutMs,
              logger,
            });
            const rows = reader.getRowObjects().map((r) => requireString(r, 'indicator'));
            return { rows };
          },
          logger,
        ),
      );
    },

    async listAreaTypes() {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.listAreaTypes',
          async () => {
            const sql = `SELECT DISTINCT area_type FROM statistics ORDER BY area_type ASC`;
            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.listAreaTypes',
              sql,
              queryTimeoutMs,
              logger,
            });
            const rows = reader.getRowObjects().map((r) => requireString(r, 'area_type'));
            return { rows };
          },
          logger,
        ),
      );
    },
  };
}
