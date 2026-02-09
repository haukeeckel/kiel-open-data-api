import {
  type AreasQueryInput,
  type RankingQueryInput,
  type TimeseriesQueryInput,
} from '../../../schemas/statistics';
import type { AreasResult, RankingResult, TimeseriesResult } from '../model/types';

export type StatisticsRepository = {
  getTimeseries(input: TimeseriesQueryInput): Promise<TimeseriesResult>;

  listAreas(input: AreasQueryInput): Promise<AreasResult>;

  getRanking(input: RankingQueryInput): Promise<RankingResult>;
};
