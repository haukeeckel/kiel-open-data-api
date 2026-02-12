import type {
  AreaTypesResult,
  AreasQuery,
  AreasResult,
  CategoriesQuery,
  CategoriesResult,
  IndicatorsResult,
  RankingQuery,
  RankingResult,
  TimeseriesQuery,
  TimeseriesResult,
} from '../model/types.js';

export type StatisticsRepository = {
  getTimeseries(input: TimeseriesQuery): Promise<TimeseriesResult>;

  listAreas(input: AreasQuery): Promise<AreasResult>;

  listCategories(input: CategoriesQuery): Promise<CategoriesResult>;

  getRanking(input: RankingQuery): Promise<RankingResult>;

  listIndicators(): Promise<IndicatorsResult>;

  listAreaTypes(): Promise<AreaTypesResult>;
};
