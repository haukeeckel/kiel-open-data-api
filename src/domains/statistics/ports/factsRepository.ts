export type Order = 'asc' | 'desc';

export type TimeseriesRow = {
  year: number;
  value: number;
  unit: string;
};

export type RankingRow = {
  area: string;
  value: number;
  unit: string;
};

export type FactsRepository = {
  getTimeseries(input: {
    indicator: string;
    areaType: string;
    area: string;
    from?: number;
    to?: number;
  }): Promise<{ indicator: string; areaType: string; area: string; rows: TimeseriesRow[] }>;

  listAreas(input: {
    indicator: string;
    areaType: string;
    like?: string;
  }): Promise<{ indicator: string; areaType: string; rows: string[] }>;

  getRanking(input: {
    indicator: string;
    areaType: string;
    year: number;
    limit: number;
    order: Order;
  }): Promise<{
    indicator: string;
    areaType: string;
    year: number;
    order: Order;
    limit: number;
    rows: RankingRow[];
  }>;
};
