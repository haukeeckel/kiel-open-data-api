import { StatisticsValidationError } from '../errors/statisticsValidationError.js';

import type { AreasQuery, CategoriesQuery, RankingQuery, TimeseriesQuery } from '../model/types.js';
import type { StatisticsRepository } from '../ports/statisticsRepository.js';

export class StatisticsQueryService {
  constructor(private readonly repo: StatisticsRepository) {}

  private throwUnknownDomainValue(args: {
    field: 'indicator' | 'areaType' | 'category';
    value: string;
    allowed: string[];
  }): never {
    const { field, value, allowed } = args;
    throw new StatisticsValidationError(`Unknown ${field}: ${value}`, {
      kind: 'domain_validation',
      field,
      value,
      allowed,
    });
  }

  private async assertKnownIndicator(indicator: string): Promise<void> {
    const indicators = await this.repo.listIndicators();
    if (!indicators.rows.includes(indicator)) {
      this.throwUnknownDomainValue({
        field: 'indicator',
        value: indicator,
        allowed: indicators.rows,
      });
    }
  }

  private async assertKnownAreaType(areaType: string): Promise<void> {
    const areaTypes = await this.repo.listAreaTypes();
    if (!areaTypes.rows.includes(areaType)) {
      this.throwUnknownDomainValue({
        field: 'areaType',
        value: areaType,
        allowed: areaTypes.rows,
      });
    }
  }

  private async assertKnownCategory(
    indicator: string,
    areaType: string,
    category: string | undefined,
  ): Promise<void> {
    if (category === undefined) return;
    const categories = await this.repo.listCategories({ indicator, areaType });
    if (!categories.rows.includes(category)) {
      this.throwUnknownDomainValue({
        field: 'category',
        value: category,
        allowed: categories.rows,
      });
    }
  }

  async getTimeseries(input: TimeseriesQuery) {
    const { from, to } = input;
    if (from !== undefined && to !== undefined && from > to) {
      throw new StatisticsValidationError('from must be <= to', { from, to });
    }
    await this.assertKnownIndicator(input.indicator);
    await this.assertKnownAreaType(input.areaType);
    await this.assertKnownCategory(input.indicator, input.areaType, input.category);

    return this.repo.getTimeseries(input);
  }

  async listAreas(input: AreasQuery) {
    await this.assertKnownIndicator(input.indicator);
    await this.assertKnownAreaType(input.areaType);
    await this.assertKnownCategory(input.indicator, input.areaType, input.category);

    return this.repo.listAreas(input);
  }

  async listCategories(input: CategoriesQuery) {
    await this.assertKnownIndicator(input.indicator);
    await this.assertKnownAreaType(input.areaType);

    return this.repo.listCategories(input);
  }

  async getRanking(input: RankingQuery) {
    await this.assertKnownIndicator(input.indicator);
    await this.assertKnownAreaType(input.areaType);
    await this.assertKnownCategory(input.indicator, input.areaType, input.category);

    return this.repo.getRanking(input);
  }

  async listIndicators() {
    return this.repo.listIndicators();
  }

  async listAreaTypes() {
    return this.repo.listAreaTypes();
  }
}
