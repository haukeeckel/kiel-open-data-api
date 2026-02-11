export const INDICATORS = ['population'] as const;
export const AREA_TYPES = ['district'] as const;
export const ORDERS = ['asc', 'desc'] as const;

export type Indicator = (typeof INDICATORS)[number];
export type AreaType = (typeof AREA_TYPES)[number];
export type Order = (typeof ORDERS)[number];

export const RANKING_LIMIT_MIN = 1;
export const RANKING_LIMIT_MAX = 100;
export const RANKING_LIMIT_DEFAULT = 50;

export type TimeseriesQuery = {
  indicator: Indicator;
  areaType: AreaType;
  area: string;
  from?: number;
  to?: number;
};

export type AreasQuery = {
  indicator: Indicator;
  areaType: AreaType;
  like?: string;
};

export type RankingQuery = {
  indicator: Indicator;
  areaType: AreaType;
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
  indicator: Indicator;
  areaType: AreaType;
  area: string;
  rows: TimeseriesRow[];
};

export type AreasResult = {
  indicator: Indicator;
  areaType: AreaType;
  rows: string[];
};

export type RankingResult = {
  indicator: Indicator;
  areaType: AreaType;
  year: number;
  order: Order;
  limit: number;
  rows: RankingRow[];
};
