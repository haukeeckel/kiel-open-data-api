import type { StatisticsRepository } from '../ports/statisticsRepository.js';
import type { AreasQuery, RankingQuery, TimeseriesQuery } from '../model/types.js';
import { StatisticsValidationError } from '../errors/statisticsValidationError.js';

export class StatisticsQueryService {
  constructor(private readonly repo: StatisticsRepository) {}

  async getTimeseries(input: TimeseriesQuery) {
    const { from, to } = input;
    if (from !== undefined && to !== undefined && from > to) {
      throw new StatisticsValidationError('from must be <= to', { from, to });
    }
    return this.repo.getTimeseries(input);
  }

  async listAreas(input: AreasQuery) {
    return this.repo.listAreas(input);
  }

  async getRanking(input: RankingQuery) {
    const limit = Math.min(50, Math.max(1, input.limit));
    return this.repo.getRanking({ ...input, limit });
  }
}
