export const ORDERS = ['asc', 'desc'] as const;

export type Order = (typeof ORDERS)[number];

export const RANKING_LIMIT_MIN = 1;
export const RANKING_LIMIT_MAX = 100;
export const RANKING_LIMIT_DEFAULT = 50;

export type TimeseriesQuery = {
  indicator: string;
  areaType: string;
  area: string;
  category?: string;
  from?: number;
  to?: number;
};

export type AreasQuery = {
  indicator: string;
  areaType: string;
  category?: string;
  like?: string;
};

export type CategoriesQuery = {
  indicator: string;
  areaType: string;
};

export type RankingQuery = {
  indicator: string;
  areaType: string;
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

export type CategoriesResult = {
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

export type IndicatorsResult = {
  rows: string[];
};

export type AreaTypesResult = {
  rows: string[];
};
