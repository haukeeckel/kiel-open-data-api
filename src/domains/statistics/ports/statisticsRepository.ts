import type {
  AreaTypesResult,
  AreasQuery,
  AreasResult,
  CategoriesQuery,
  CategoriesResult,
  IndicatorMetaResult,
  IndicatorsQuery,
  IndicatorsResult,
  RankingQuery,
  RankingResult,
  TimeseriesQuery,
  TimeseriesResult,
  YearMetaResult,
  YearsQuery,
  YearsResult,
} from '../model/types.js';

export type StatisticsRepository = {
  getTimeseries(input: TimeseriesQuery): Promise<TimeseriesResult>;

  listAreas(input: AreasQuery): Promise<AreasResult>;

  listCategories(input: CategoriesQuery): Promise<CategoriesResult>;

  getRanking(input: RankingQuery): Promise<RankingResult>;

  listYears(input?: YearsQuery): Promise<YearsResult>;

  getYearMeta(year: number): Promise<YearMetaResult | null>;

  getIndicatorMeta(indicator: string): Promise<IndicatorMetaResult | null>;

  listIndicators(query?: IndicatorsQuery): Promise<IndicatorsResult>;

  listAreaTypes(): Promise<AreaTypesResult>;
};
