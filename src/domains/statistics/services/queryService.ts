import { type Order } from '../model/types';
import { StatisticsValidationError } from '../errors/statisticsValidationError';
import type { FactsRepository } from '../ports/factsRepository';

export class StatisticsQueryService {
  constructor(private readonly repo: FactsRepository) {}

  async getTimeseries(input: {
    indicator: string;
    areaType: string;
    area: string;
    from?: number;
    to?: number;
  }) {
    // kleine Domain-Regel: from <= to, wenn beide gesetzt
    if (input.from !== undefined && input.to !== undefined && input.from > input.to) {
      throw new StatisticsValidationError('from must be <= to', {
        from: input.from,
        to: input.to,
      });
    }
    return this.repo.getTimeseries(input);
  }

  async listAreas(input: { indicator: string; areaType: string; like?: string }) {
    return this.repo.listAreas(input);
  }

  async getRanking(input: {
    indicator: string;
    areaType: string;
    year: number;
    limit: number;
    order: Order;
  }) {
    // Domain-Regeln: limit clamp
    const limit = Math.min(50, Math.max(1, input.limit));
    return this.repo.getRanking({ ...input, limit });
  }
}
