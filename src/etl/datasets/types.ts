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
  category: {
    slug: string;
    label?: string | undefined;
  };
  indicator?: string | undefined;
  unit?: string | undefined;
} & (
  | {
      valueColumn: string;
      valueColumns?: readonly string[] | undefined;
      valueExpression?: string | undefined;
    }
  | {
      valueColumn?: string | undefined;
      valueColumns: readonly string[];
      valueExpression?: string | undefined;
    }
  | {
      valueColumn?: string | undefined;
      valueColumns?: readonly string[] | undefined;
      valueExpression: string;
    }
);

type UnpivotCategoriesFilter =
  | {
      filterColumn: string;
      filterValue: string;
    }
  | {
      filterColumn?: undefined;
      filterValue?: undefined;
    };

export type UnpivotCategoriesFormat = {
  type: 'unpivot_categories';
  yearColumn: string;
  yearParser?: ((value: string) => number) | undefined;
  dedupeByAreaYearKeepLast?: boolean | undefined;
  indicator?: string | undefined;
  unit?: string | undefined;
  columns: readonly UnpivotCategoriesColumn[];
} & UnpivotCategoriesFilter;

export type CsvFormat = UnpivotYearsFormat | UnpivotCategoriesFormat;

export type DatasetConfig = {
  id: string;
  url: string;
  csvFilename: string;
  csvDelimiter?: string | undefined;
  columnAliases?: Record<string, readonly string[]> | undefined;
  areaType: string;
  areaColumn?: string | undefined;
  areaExpression?: string | undefined;
  defaultAreaName?: string | undefined;
  format: CsvFormat;
};
