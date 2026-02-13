import { StatisticsValidationError } from '../errors/statisticsValidationError.js';

import type { AreasQuery, CategoriesQuery, RankingQuery, TimeseriesQuery } from '../model/types.js';
import type { StatisticsRepository } from '../ports/statisticsRepository.js';

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

  async listCategories(input: CategoriesQuery) {
    return this.repo.listCategories(input);
  }

  async getRanking(input: RankingQuery) {
    return this.repo.getRanking(input);
  }

  async listIndicators() {
    return this.repo.listIndicators();
  }

  async listAreaTypes() {
    return this.repo.listAreaTypes();
  }
}
