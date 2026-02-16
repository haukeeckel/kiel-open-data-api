import { StatisticsNotFoundError } from '../errors/statisticsNotFoundError.js';
import { StatisticsValidationError } from '../errors/statisticsValidationError.js';

import type {
  AreasQuery,
  BulkResult,
  BulkRequest,
  CategoriesQuery,
  IndicatorsQuery,
  RankingQuery,
  TimeseriesQuery,
  YearsQuery,
} from '../model/types.js';
import type { StatisticsRepository } from '../ports/statisticsRepository.js';

type CacheEntry = {
  value: string[];
  expiresAt: number;
};

type StatisticsQueryServiceOptions = {
  validationCacheEnabled?: boolean;
  validationCacheTtlMs?: number;
};

export class StatisticsQueryService {
  private readonly validationCacheEnabled: boolean;
  private readonly validationCacheTtlMs: number;
  private indicatorsCache: CacheEntry | null = null;
  private areaTypesCache: CacheEntry | null = null;
  private readonly categoriesCache = new Map<string, CacheEntry>();

  constructor(
    private readonly repo: StatisticsRepository,
    options: StatisticsQueryServiceOptions = {},
  ) {
    this.validationCacheEnabled = options.validationCacheEnabled ?? true;
    this.validationCacheTtlMs = options.validationCacheTtlMs ?? 30_000;
  }

  private nowMs(): number {
    return Date.now();
  }

  private isFresh(entry: CacheEntry | null): entry is CacheEntry {
    return entry !== null && entry.expiresAt > this.nowMs();
  }

  private cacheKey(indicator: string, areaType: string): string {
    return `${indicator}::${areaType}`;
  }

  private async loadIndicators(): Promise<string[]> {
    if (!this.validationCacheEnabled) {
      return (await this.repo.listIndicators()).rows;
    }
    if (this.isFresh(this.indicatorsCache)) {
      return this.indicatorsCache.value;
    }
    const rows = (await this.repo.listIndicators()).rows;
    this.indicatorsCache = { value: rows, expiresAt: this.nowMs() + this.validationCacheTtlMs };
    return rows;
  }

  private async loadAreaTypes(): Promise<string[]> {
    if (!this.validationCacheEnabled) {
      return (await this.repo.listAreaTypes()).rows;
    }
    if (this.isFresh(this.areaTypesCache)) {
      return this.areaTypesCache.value;
    }
    const rows = (await this.repo.listAreaTypes()).rows;
    this.areaTypesCache = { value: rows, expiresAt: this.nowMs() + this.validationCacheTtlMs };
    return rows;
  }

  private async loadCategories(indicator: string, areaType: string): Promise<string[]> {
    if (!this.validationCacheEnabled) {
      return (await this.repo.listCategories({ indicator, areaType })).rows;
    }
    const key = this.cacheKey(indicator, areaType);
    const cached = this.categoriesCache.get(key) ?? null;
    if (this.isFresh(cached)) {
      return cached.value;
    }
    const rows = (await this.repo.listCategories({ indicator, areaType })).rows;
    this.categoriesCache.set(key, {
      value: rows,
      expiresAt: this.nowMs() + this.validationCacheTtlMs,
    });
    return rows;
  }

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
    const indicators = await this.loadIndicators();
    if (!indicators.includes(indicator)) {
      this.throwUnknownDomainValue({
        field: 'indicator',
        value: indicator,
        allowed: indicators,
      });
    }
  }

  private async assertKnownAreaType(areaType: string): Promise<void> {
    const areaTypes = await this.loadAreaTypes();
    if (!areaTypes.includes(areaType)) {
      this.throwUnknownDomainValue({
        field: 'areaType',
        value: areaType,
        allowed: areaTypes,
      });
    }
  }

  private async assertKnownCategory(
    indicator: string,
    areaType: string,
    category: string | undefined,
  ): Promise<void> {
    if (category === undefined) return;
    const categories = await this.loadCategories(indicator, areaType);
    if (!categories.includes(category)) {
      this.throwUnknownDomainValue({
        field: 'category',
        value: category,
        allowed: categories,
      });
    }
  }

  private async assertKnownCategories(
    indicator: string,
    areaType: string,
    categories: string[] | undefined,
  ): Promise<void> {
    if (categories === undefined || categories.length === 0) return;
    const allowed = await this.loadCategories(indicator, areaType);
    const unknown = categories.find((category) => !allowed.includes(category));
    if (unknown !== undefined) {
      this.throwUnknownDomainValue({
        field: 'category',
        value: unknown,
        allowed,
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
    await this.assertKnownCategories(input.indicator, input.areaType, input.categories);

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
    await this.assertKnownCategories(input.indicator, input.areaType, input.categories);

    return this.repo.getRanking(input);
  }

  async listYears(input: YearsQuery = {}) {
    if (input.areaType !== undefined) {
      await this.assertKnownAreaType(input.areaType);
    }
    return this.repo.listYears(input);
  }

  async getYearMeta(year: number) {
    const result = await this.repo.getYearMeta(year);
    if (result === null) {
      throw new StatisticsNotFoundError(`Year not found: ${year}`);
    }
    return result;
  }

  async getIndicatorMeta(indicator: string) {
    const result = await this.repo.getIndicatorMeta(indicator);
    if (result === null) {
      throw new StatisticsNotFoundError(`Indicator not found: ${indicator}`);
    }
    return result;
  }

  async listIndicators(query?: IndicatorsQuery) {
    if (query?.areaType !== undefined) {
      await this.assertKnownAreaType(query.areaType);
    }
    return this.repo.listIndicators(query);
  }

  async listAreaTypes() {
    return this.repo.listAreaTypes();
  }

  async getCapabilities() {
    return this.repo.getCapabilities();
  }

  async executeBulk(input: BulkRequest): Promise<BulkResult> {
    const results: BulkResult['results'] = [];
    for (const item of input.items) {
      if (item.kind === 'timeseries') {
        const data = await this.getTimeseries(item.query);
        results.push({ kind: 'timeseries', data } as const);
        continue;
      }
      if (item.kind === 'ranking') {
        const data = await this.getRanking(item.query);
        results.push({ kind: 'ranking', data } as const);
        continue;
      }
      const data = await this.getCapabilities();
      results.push({ kind: 'capabilities', data } as const);
    }
    return { results };
  }
}
