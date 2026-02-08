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

export type TimeseriesResult = {
  indicator: string;
  areaType: string;
  area: string;
  rows: TimeseriesRow[];
};

export type AreasResult = {
  indicator: string;
  areaType: string;
  rows: string[];
};

export type RankingResult = {
  indicator: string;
  areaType: string;
  year: number;
  order: Order;
  limit: number;
  rows: RankingRow[];
};
