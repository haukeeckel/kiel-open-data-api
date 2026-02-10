import type {
  TimeseriesQuery,
  AreasQuery,
  RankingQuery,
} from '../../domains/statistics/model/types.js';
import {
  type RankingQueryInput,
  type AreasQueryInput,
  type TimeseriesQueryInput,
} from '../../schemas/statistics.js';

export function toTimeseriesQuery(query: TimeseriesQueryInput): TimeseriesQuery {
  return {
    indicator: query.indicator,
    areaType: query.areaType,
    area: query.area,
    ...(query.from !== undefined ? { from: query.from } : {}),
    ...(query.to !== undefined ? { to: query.to } : {}),
  };
}

export function toAreasQuery(query: AreasQueryInput): AreasQuery {
  return {
    indicator: query.indicator,
    areaType: query.areaType,
    ...(query.like !== undefined ? { like: query.like } : {}),
  };
}

export function toRankingQuery(query: RankingQueryInput): RankingQuery {
  return {
    indicator: query.indicator,
    areaType: query.areaType,
    year: query.year,
    limit: query.limit,
    order: query.order,
  };
}
