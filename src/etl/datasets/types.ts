export type UnpivotYearsRow = {
  filterValue: string;
  indicator: string;
  unit: string;
  category: string;
};

export type UnpivotYearsFormat = {
  type: 'unpivot_years';
  indicatorColumn: string;
  yearPattern?: RegExp | undefined;
  yearParser?: ((col: string) => number) | undefined;
  rows: readonly UnpivotYearsRow[];
};

export type CsvFormat = UnpivotYearsFormat;

export type DatasetConfig = {
  id: string;
  url: string;
  csvFilename: string;
  areaType: string;
  areaColumn?: string | undefined;
  defaultAreaName?: string | undefined;
  format: CsvFormat;
};
