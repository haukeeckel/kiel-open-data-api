export const ORDERS = ['asc', 'desc'] as const;

export type Order = (typeof ORDERS)[number];

export const RANKING_LIMIT_MIN = 1;
export const RANKING_LIMIT_MAX = 100;
export const RANKING_LIMIT_DEFAULT = 50;
export const PAGINATION_LIMIT_MIN = 1;
export const PAGINATION_LIMIT_MAX = 500;
export const PAGINATION_LIMIT_DEFAULT = 50;
export const PAGINATION_OFFSET_DEFAULT = 0;

export type TimeseriesQuery = {
  indicator: string;
  areaType: string;
  areas: string[];
  categories?: string[];
  from?: number;
  to?: number;
  limit: number;
  offset: number;
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

export type YearsQuery = {
  indicator?: string;
  areaType?: string;
  category?: string;
  area?: string;
  limit?: number;
  offset?: number;
};

export type RankingQuery = {
  indicator: string;
  areaType: string;
  year: number;
  categories?: string[];
  areas?: string[];
  limit: number;
  order: Order;
};

export type TimeseriesRow = {
  area: string;
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
  areas: string[];
  rows: TimeseriesRow[];
  pagination: PaginationMeta;
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
  pagination: PaginationMeta;
};

export type IndicatorsQuery = {
  areaType?: string;
  area?: string;
  year?: number;
  limit?: number;
  offset?: number;
};

export type YearsResult = {
  rows: number[];
  pagination: PaginationMeta;
};

export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type YearMetaAreaType = {
  areaType: string;
  indicators: string[];
  categories: string[];
  areas: string[];
};

export type YearMetaResult = {
  year: number;
  areaTypes: YearMetaAreaType[];
};

export type IndicatorMetaAreaType = {
  areaType: string;
  years: number[];
  categories: string[];
  areas: string[];
};

export type IndicatorMetaResult = {
  indicator: string;
  areaTypes: IndicatorMetaAreaType[];
};

export type AreaTypesResult = {
  rows: string[];
};
