# DB Hot Path Explain and Benchmark Baseline

Stand: 2026-02-14

This document captures the baseline procedure for validating hot-path query behavior after PR-01.

## Scope

- Ranking query hot path: `(indicator, area_type, year[, category])`
- Distinct queries: `listIndicators`, `listAreaTypes`, `listCategories`

## Preconditions

- Database is initialized and migrated: `pnpm migrate`
- Representative dataset is imported
- Run on a quiet machine for comparable timings

## Explain Analyze Queries

### Ranking (with category)

```sql
EXPLAIN ANALYZE
SELECT area_name, value, unit, category
FROM statistics
WHERE indicator = 'population'
  AND area_type = 'district'
  AND year = 2023
  AND category = 'total'
ORDER BY value DESC
LIMIT 10;
```

### Ranking (without category)

```sql
EXPLAIN ANALYZE
SELECT area_name, value, unit, category
FROM statistics
WHERE indicator = 'population'
  AND area_type = 'district'
  AND year = 2023
ORDER BY value DESC
LIMIT 10;
```

### Distinct indicators

```sql
EXPLAIN ANALYZE
SELECT DISTINCT indicator FROM statistics ORDER BY indicator ASC;
```

### Distinct area types

```sql
EXPLAIN ANALYZE
SELECT DISTINCT area_type FROM statistics ORDER BY area_type ASC;
```

### Distinct categories

```sql
EXPLAIN ANALYZE
SELECT DISTINCT category
FROM statistics
WHERE indicator = 'population' AND area_type = 'district'
ORDER BY category ASC;
```

## Baseline Benchmark Procedure

1. Warm-up once by running each query without timing.
2. For each query, execute 30 runs and record p50/p95 latency in milliseconds.
3. Compare before/after index migration under the same dataset and machine conditions.

Recommended shell pattern (adapt command to your SQL runner):

```sh
# pseudo workflow
# 1) run query in loop
# 2) capture durations
# 3) aggregate p50/p95
```

## Acceptance Thresholds

- Ranking and distinct queries show no regression vs baseline.
- At least one of ranking or distinct paths shows measurable improvement under representative load.
- Explain plans confirm index usage for targeted predicates/order where applicable.
