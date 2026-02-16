import crypto from 'node:crypto';

import {
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_LIMIT_MAX,
  PAGINATION_LIMIT_MIN,
  RANKING_LIMIT_DEFAULT,
  RANKING_LIMIT_MAX,
  RANKING_LIMIT_MIN,
} from '../../domains/statistics/model/types.js';
import { recordDbQuery } from '../../observability/metrics.js';

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

function requireInteger(row: Record<string, unknown>, key: string): number {
  const value = requireNumber(row, key);
  if (!Number.isInteger(value)) {
    throw new Error(`statistics row invalid ${key}: expected integer`);
  }
  return value;
}

function requireString(row: Record<string, unknown>, key: string): string {
  const value = requireValue(row, key);
  if (typeof value !== 'string') {
    throw new Error(`statistics row invalid ${key}: expected string`);
  }
  return value;
}

function toIsoTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function appendInClause(
  sql: string,
  values: Array<string | number>,
  column: string,
  items: string[],
): string {
  if (items.length === 0) return sql;
  const placeholders = items.map(() => '?').join(', ');
  values.push(...items);
  return `${sql} AND ${column} IN (${placeholders})`;
}

type RepositoryLogger = Pick<Logger, 'warn'>;

type CreateRepositoryOptions = {
  queryTimeoutMs: number;
  slowQueryThresholdMs?: number;
  planSampleEnabled?: boolean;
  logger?: RepositoryLogger;
};

type QueryArgs = {
  conn: DuckDBConnection;
  operation: string;
  sql: string;
  values?: Array<string | number>;
  queryTimeoutMs: number;
  slowQueryThresholdMs: number;
  planSampleEnabled: boolean;
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
  let settled = false;
  let timedOut = false;
  const started = process.hrtime.bigint();

  try {
    const queryPromise = conn.runAndReadAll(sql, values).finally(() => {
      settled = true;
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        try {
          conn.interrupt();
        } catch {}
        reject(new RepositoryQueryTimeoutError({ operation, timeoutMs: queryTimeoutMs }));
      }, queryTimeoutMs);
    });
    const result = await Promise.race([queryPromise, timeoutPromise]);
    const seconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
    recordDbQuery(operation, 'ok', seconds);
    const durationMs = seconds * 1000;
    if (durationMs >= args.slowQueryThresholdMs) {
      logger?.warn?.(
        {
          operation,
          durationMs: Number(durationMs.toFixed(2)),
          thresholdMs: args.slowQueryThresholdMs,
        },
        'slow repository query detected',
      );
      if (args.planSampleEnabled) {
        // Stub hook: emit a clear marker for optional plan-sampling rollout.
        logger?.warn?.({ operation }, 'query plan sampling is enabled but not yet implemented');
      }
    }
    return result;
  } catch (err) {
    const seconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
    if (err instanceof RepositoryQueryTimeoutError) {
      recordDbQuery(operation, 'timeout', seconds);
      logger?.warn?.(
        { operation, timeoutMs: queryTimeoutMs, values: summarizeValues(values) },
        'repository query timed out',
      );
      throw err;
    }
    if (timedOut) {
      const timeoutErr = new RepositoryQueryTimeoutError({
        operation,
        timeoutMs: queryTimeoutMs,
        cause: err,
      });
      recordDbQuery(operation, 'timeout', seconds);
      logger?.warn?.(
        {
          operation,
          timeoutMs: queryTimeoutMs,
          values: summarizeValues(values),
          err: toError(err),
        },
        'repository query timed out after interrupt',
      );
      throw timeoutErr;
    }
    const wrapped = new RepositoryInfraError({
      operation,
      message: `Repository operation failed: ${operation}`,
      cause: err,
    });
    recordDbQuery(operation, 'error', seconds);
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
  const slowQueryThresholdMs = options.slowQueryThresholdMs ?? 500;
  const planSampleEnabled = options.planSampleEnabled ?? false;
  const logger = options.logger;

  return {
    async getTimeseries(input) {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.getTimeseries',
          async () => {
            const filterValues: Array<string | number> = [input.indicator, input.areaType];
            let filterSql = `FROM statistics WHERE indicator = ? AND area_type = ?`;
            filterSql = appendInClause(filterSql, filterValues, 'area_name', input.areas);
            if (input.categories !== undefined) {
              filterSql = appendInClause(filterSql, filterValues, 'category', input.categories);
            }
            if (input.from !== undefined) {
              filterSql += ` AND year >= ?`;
              filterValues.push(input.from);
            }
            if (input.to !== undefined) {
              filterSql += ` AND year <= ?`;
              filterValues.push(input.to);
            }

            const countReader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getTimeseries',
              sql: `SELECT COUNT(*) AS total ${filterSql}`,
              values: filterValues,
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const total = requireInteger(countReader.getRowObjects()[0] ?? {}, 'total');

            const sql = `
          SELECT area_name, year, value, unit, category
          ${filterSql}
          ORDER BY area_name ASC, year ASC
          LIMIT ? OFFSET ?
        `;
            const values = [...filterValues, input.limit, input.offset];

            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getTimeseries',
              sql,
              values,
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const rows = reader.getRowObjects().map((r) => ({
              area: requireString(r, 'area_name'),
              year: requireNumber(r, 'year'),
              value: requireNumber(r, 'value'),
              unit: requireString(r, 'unit'),
              category: requireString(r, 'category'),
            }));
            const areas = Array.from(new Set(rows.map((r) => r.area))).sort((a, b) =>
              a.localeCompare(b),
            );

            return {
              indicator: input.indicator,
              areaType: input.areaType,
              areas,
              rows,
              pagination: {
                total,
                limit: input.limit,
                offset: input.offset,
                hasMore: input.offset + rows.length < total,
              },
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

            if (input.category !== undefined) {
              sql += ` AND category = ?`;
              params.push(input.category);
            }

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
              slowQueryThresholdMs,
              planSampleEnabled,
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
              slowQueryThresholdMs,
              planSampleEnabled,
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
            const values: Array<string | number> = [input.indicator, input.areaType, input.year];
            let sql = `
          SELECT area_name, value, unit, category
          FROM statistics
          WHERE indicator = ? AND area_type = ? AND year = ?
          `;
            if (input.categories !== undefined) {
              sql = appendInClause(sql, values, 'category', input.categories);
            }
            if (input.areas !== undefined) {
              sql = appendInClause(sql, values, 'area_name', input.areas);
            }
            sql += `
          ORDER BY value ${input.order === 'asc' ? 'ASC' : 'DESC'}
          LIMIT ?
          `;
            values.push(input.limit);
            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getRanking',
              sql,
              values,
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
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

    async listYears(input) {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.listYears',
          async () => {
            const offset = input?.offset ?? 0;
            const limit = input?.limit;
            const values: Array<string | number> = [];
            let filterSql = `FROM statistics`;
            const conditions: string[] = [];
            if (input?.indicator !== undefined) {
              conditions.push('indicator = ?');
              values.push(input.indicator);
            }
            if (input?.areaType !== undefined) {
              conditions.push('area_type = ?');
              values.push(input.areaType);
            }
            if (input?.category !== undefined) {
              conditions.push('category = ?');
              values.push(input.category);
            }
            if (input?.area !== undefined) {
              conditions.push('area_name = ?');
              values.push(input.area);
            }
            if (conditions.length > 0) {
              filterSql += ` WHERE ${conditions.join(' AND ')}`;
            }

            const countReader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.listYears',
              sql: `SELECT COUNT(DISTINCT year) AS total ${filterSql}`,
              ...(values.length > 0 ? { values } : {}),
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const total = requireInteger(countReader.getRowObjects()[0] ?? {}, 'total');

            const sql = `
          SELECT DISTINCT year
          ${filterSql}
          ORDER BY year ASC
          ${limit !== undefined ? `LIMIT ? OFFSET ?` : ''}
        `;
            const queryValues = limit !== undefined ? [...values, limit, offset] : values;
            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.listYears',
              sql,
              ...(queryValues.length > 0 ? { values: queryValues } : {}),
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const rows = reader.getRowObjects().map((r) => requireInteger(r, 'year'));
            return {
              rows,
              pagination: {
                total,
                limit: limit ?? total,
                offset,
                hasMore: limit !== undefined ? offset + rows.length < total : false,
              },
            };
          },
          logger,
        ),
      );
    },

    async getYearMeta(year) {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.getYearMeta',
          async () => {
            const sql = `
          SELECT area_type, indicator, category, area_name
          FROM statistics
          WHERE year = ?
          GROUP BY area_type, indicator, category, area_name
          `;
            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getYearMeta',
              sql,
              values: [year],
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const rows = reader.getRowObjects();
            if (rows.length === 0) return null;

            const byAreaType = new Map<
              string,
              { indicators: Set<string>; categories: Set<string>; areas: Set<string> }
            >();
            for (const row of rows) {
              const areaType = requireString(row, 'area_type');
              const indicator = requireString(row, 'indicator');
              const category = requireString(row, 'category');
              const area = requireString(row, 'area_name');

              const current = byAreaType.get(areaType) ?? {
                indicators: new Set<string>(),
                categories: new Set<string>(),
                areas: new Set<string>(),
              };
              current.indicators.add(indicator);
              current.categories.add(category);
              current.areas.add(area);
              byAreaType.set(areaType, current);
            }

            const areaTypes = Array.from(byAreaType.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([areaType, value]) => ({
                areaType,
                indicators: Array.from(value.indicators).sort((a, b) => a.localeCompare(b)),
                categories: Array.from(value.categories).sort((a, b) => a.localeCompare(b)),
                areas: Array.from(value.areas).sort((a, b) => a.localeCompare(b)),
              }));

            return { year, areaTypes };
          },
          logger,
        ),
      );
    },

    async getIndicatorMeta(indicator) {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.getIndicatorMeta',
          async () => {
            const sql = `
          SELECT area_type, area_name, year, category
          FROM statistics
          WHERE indicator = ?
          GROUP BY area_type, area_name, year, category
          `;
            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getIndicatorMeta',
              sql,
              values: [indicator],
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const rows = reader.getRowObjects();
            if (rows.length === 0) return null;

            const byAreaType = new Map<
              string,
              { years: Set<number>; categories: Set<string>; areas: Set<string> }
            >();
            for (const row of rows) {
              const areaType = requireString(row, 'area_type');
              const area = requireString(row, 'area_name');
              const year = requireInteger(row, 'year');
              const category = requireString(row, 'category');

              const current = byAreaType.get(areaType) ?? {
                years: new Set<number>(),
                categories: new Set<string>(),
                areas: new Set<string>(),
              };
              current.years.add(year);
              current.categories.add(category);
              current.areas.add(area);
              byAreaType.set(areaType, current);
            }

            const areaTypes = Array.from(byAreaType.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([areaType, value]) => ({
                areaType,
                years: Array.from(value.years).sort((a, b) => a - b),
                categories: Array.from(value.categories).sort((a, b) => a.localeCompare(b)),
                areas: Array.from(value.areas).sort((a, b) => a.localeCompare(b)),
              }));

            return { indicator, areaTypes };
          },
          logger,
        ),
      );
    },

    async listIndicators(query) {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.listIndicators',
          async () => {
            const offset = query?.offset ?? 0;
            const limit = query?.limit;
            const values: Array<string | number> = [];
            let filterSql = `FROM statistics`;
            const conditions: string[] = [];
            if (query?.areaType !== undefined) {
              conditions.push('area_type = ?');
              values.push(query.areaType);
            }
            if (query?.area !== undefined) {
              conditions.push('area_name = ?');
              values.push(query.area);
            }
            if (query?.year !== undefined) {
              conditions.push('year = ?');
              values.push(query.year);
            }
            if (conditions.length > 0) {
              filterSql += ` WHERE ${conditions.join(' AND ')}`;
            }

            const countReader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.listIndicators',
              sql: `SELECT COUNT(DISTINCT indicator) AS total ${filterSql}`,
              ...(values.length > 0 ? { values } : {}),
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const total = requireInteger(countReader.getRowObjects()[0] ?? {}, 'total');

            const sql = `
          SELECT DISTINCT indicator
          ${filterSql}
          ORDER BY indicator ASC
          ${limit !== undefined ? `LIMIT ? OFFSET ?` : ''}
        `;
            const queryValues = limit !== undefined ? [...values, limit, offset] : values;
            const reader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.listIndicators',
              sql,
              ...(queryValues.length > 0 ? { values: queryValues } : {}),
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const rows = reader.getRowObjects().map((r) => requireString(r, 'indicator'));
            return {
              rows,
              pagination: {
                total,
                limit: limit ?? total,
                offset,
                hasMore: limit !== undefined ? offset + rows.length < total : false,
              },
            };
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
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const rows = reader.getRowObjects().map((r) => requireString(r, 'area_type'));
            return { rows };
          },
          logger,
        ),
      );
    },

    async getCapabilities() {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.getCapabilities',
          async () => {
            const areaTypesReader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getCapabilities',
              sql: `SELECT DISTINCT area_type FROM statistics ORDER BY area_type ASC`,
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const indicatorReader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getCapabilities',
              sql: `SELECT DISTINCT indicator FROM statistics ORDER BY indicator ASC`,
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const yearsReader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getCapabilities',
              sql: `SELECT DISTINCT year FROM statistics ORDER BY year ASC`,
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            return {
              areaTypes: areaTypesReader
                .getRowObjects()
                .map((row) => requireString(row, 'area_type')),
              indicators: indicatorReader
                .getRowObjects()
                .map((row) => requireString(row, 'indicator')),
              years: yearsReader.getRowObjects().map((row) => requireInteger(row, 'year')),
              limits: {
                pagination: {
                  min: PAGINATION_LIMIT_MIN,
                  max: PAGINATION_LIMIT_MAX,
                  default: PAGINATION_LIMIT_DEFAULT,
                },
                ranking: {
                  min: RANKING_LIMIT_MIN,
                  max: RANKING_LIMIT_MAX,
                  default: RANKING_LIMIT_DEFAULT,
                },
              },
            };
          },
          logger,
        ),
      );
    },

    async getFreshnessMeta() {
      return manager.withConnection((conn) =>
        withRepositoryError(
          'statistics.getFreshnessMeta',
          async () => {
            const baseReader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getFreshnessMeta',
              sql: `
                SELECT COUNT(*) AS row_count, MAX(loaded_at) AS last_updated_at
                FROM statistics
              `,
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const baseRow = baseReader.getRowObjects()[0] ?? {};
            const rowCount = requireInteger(baseRow, 'row_count');
            const lastUpdatedAt = toIsoTimestamp(baseRow['last_updated_at']);

            const versionsReader = await runQueryWithTimeout({
              conn,
              operation: 'statistics.getFreshnessMeta',
              sql: `
                SELECT DISTINCT data_version
                FROM statistics
                ORDER BY data_version ASC
              `,
              queryTimeoutMs,
              slowQueryThresholdMs,
              planSampleEnabled,
              logger,
            });
            const versions = versionsReader
              .getRowObjects()
              .map((row) => (row['data_version'] == null ? '' : String(row['data_version'])));

            const fingerprint = JSON.stringify({
              rowCount,
              lastUpdatedAt,
              versions,
            });
            const dataVersion = crypto.createHash('sha256').update(fingerprint).digest('hex');

            return { dataVersion, lastUpdatedAt };
          },
          logger,
        ),
      );
    },
  };
}
