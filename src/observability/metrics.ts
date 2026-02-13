import { Counter, Histogram, Registry } from 'prom-client';

export type DbQueryStatus = 'ok' | 'timeout' | 'error';

const registry = new Registry();

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

const dbQueriesTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of repository DB queries',
  labelNames: ['operation', 'status'] as const,
  registers: [registry],
});

const dbQueryDurationSeconds = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Repository DB query duration in seconds',
  labelNames: ['operation', 'status'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [registry],
});

export const metricsRegistry = registry;

export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number,
): void {
  const labels = { method: method.toUpperCase(), route, status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, durationSeconds);
}

export function recordDbQuery(
  operation: string,
  status: DbQueryStatus,
  durationSeconds: number,
): void {
  const labels = { operation, status };
  dbQueriesTotal.inc(labels);
  dbQueryDurationSeconds.observe(labels, durationSeconds);
}

export function resetMetricsForTests(): void {
  registry.resetMetrics();
}
