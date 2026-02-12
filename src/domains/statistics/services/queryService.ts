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
    const result = await this.repo.getTimeseries(input);
    if (input.category === undefined) return result;
    return {
      ...result,
      rows: result.rows.filter((row) => row.category === input.category),
    };
  }

  async listAreas(input: AreasQuery) {
    return this.repo.listAreas(input);
  }

  async listCategories(input: CategoriesQuery) {
    return this.repo.listCategories(input);
  }

  async getRanking(input: RankingQuery) {
    const result = await this.repo.getRanking(input);
    if (input.category === undefined) return result;
    return {
      ...result,
      rows: result.rows.filter((row) => row.category === input.category),
    };
  }
}
