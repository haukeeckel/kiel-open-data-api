export const INDICATORS = ['population', 'households'] as const;
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
  category?: string;
  from?: number;
  to?: number;
};

export type AreasQuery = {
  indicator: Indicator;
  areaType: AreaType;
  category?: string;
  like?: string;
};

export type CategoriesQuery = {
  indicator: Indicator;
  areaType: AreaType;
};

export type RankingQuery = {
  indicator: Indicator;
  areaType: AreaType;
  year: number;
  category?: string;
  limit: number;
  order: Order;
};

export type TimeseriesRow = {
  year: number;
  value: number;
  unit: string;
  category: string;
};

export type RankingRow = {
  area: string;
  value: number;
  unit: string;
  category: string;
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

export type CategoriesResult = {
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
