export type Order = 'asc' | 'desc';

export type TimeseriesQuery = {
  indicator: string;
  areaType: string;
  area: string;
  from?: number;
  to?: number;
};

export type AreasQuery = {
  indicator: string;
  areaType: string;
  like?: string;
};

export type RankingQuery = {
  indicator: string;
  areaType: string;
  year: number;
  limit: number;
  order: Order;
};

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
