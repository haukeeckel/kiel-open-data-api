export type UnpivotYearsRow = {
  filterValue: string;
  indicator: string;
  unit: string;
  valueExpression?: string | undefined;
  category: {
    slug: string;
    label?: string | undefined;
  };
};

export type UnpivotYearsFormat = {
  type: 'unpivot_years';
  indicatorColumn: string;
  yearPattern?: RegExp | undefined;
  yearParser?: ((col: string) => number) | undefined;
  rows: readonly UnpivotYearsRow[];
};

export type UnpivotCategoriesColumn = {
  valueColumn?: string | undefined;
  valueExpression?: string | undefined;
  category: {
    slug: string;
    label?: string | undefined;
  };
  indicator?: string | undefined;
  unit?: string | undefined;
};

export type UnpivotCategoriesFormat = {
  type: 'unpivot_categories';
  yearColumn: string;
  yearParser?: ((value: string) => number) | undefined;
  dedupeByAreaYearKeepLast?: boolean | undefined;
  filterColumn?: string | undefined;
  filterValue?: string | undefined;
  indicator?: string | undefined;
  unit?: string | undefined;
  columns: readonly UnpivotCategoriesColumn[];
};

export type CsvFormat = UnpivotYearsFormat | UnpivotCategoriesFormat;

export type DatasetConfig = {
  id: string;
  url: string;
  csvFilename: string;
  areaType: string;
  areaColumn?: string | undefined;
  areaExpression?: string | undefined;
  defaultAreaName?: string | undefined;
  format: CsvFormat;
};
