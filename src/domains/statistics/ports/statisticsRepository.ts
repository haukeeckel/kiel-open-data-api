import type {
  AreasQuery,
  AreasResult,
  RankingQuery,
  RankingResult,
  TimeseriesQuery,
  TimeseriesResult,
} from '../model/types';

export type StatisticsRepository = {
  getTimeseries(input: TimeseriesQuery): Promise<TimeseriesResult>;

  listAreas(input: AreasQuery): Promise<AreasResult>;

  getRanking(input: RankingQuery): Promise<RankingResult>;
};
