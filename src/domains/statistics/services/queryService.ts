import type { StatisticsRepository } from '../ports/statisticsRepository';
import type {
  TimeseriesQueryInput,
  AreasQueryInput,
  RankingQueryInput,
} from '../../../schemas/statistics';
import { StatisticsValidationError } from '../errors/statisticsValidationError';

export class StatisticsQueryService {
  constructor(private readonly repo: StatisticsRepository) {}

  async getTimeseries(input: TimeseriesQueryInput) {
    const from = input.from;
    const to = input.to;

    if (from !== undefined && to !== undefined && from > to) {
      throw new StatisticsValidationError('from must be <= to', { from, to });
    }

    return this.repo.getTimeseries(stripUndefined(input));
  }

  async listAreas(input: AreasQueryInput) {
    return this.repo.listAreas(stripUndefined(input));
  }

  async getRanking(input: RankingQueryInput) {
    const limit = Math.min(50, Math.max(1, input.limit));
    return this.repo.getRanking({ ...input, limit });
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}
