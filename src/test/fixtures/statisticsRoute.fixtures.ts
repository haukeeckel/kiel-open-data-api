export type TimeseriesRowFixture = {
  area: string;
  year: number;
  value: number;
  unit: string;
  category: string;
};

export type TimeseriesUnfilteredCase = {
  indicator: string;
  rows: TimeseriesRowFixture[];
};

export type TimeseriesCategoryCase = {
  indicator: string;
  category: string;
  rows: TimeseriesRowFixture[];
};

export type CategoriesCase = {
  indicator: string;
  rows: string[];
};

export type RankingRowFixture = {
  area: string;
  value: number;
  unit: string;
  category: string;
};

export type RankingUnfilteredCase = {
  indicator: string;
  year: number;
  rows: RankingRowFixture[];
};

export type RankingCategoryCase = {
  indicator: string;
  year: number;
  category: string;
  rows: RankingRowFixture[];
};

export const TIMESERIES_UNFILTERED_CASES: TimeseriesUnfilteredCase[] = [
  {
    indicator: 'population',
    rows: [
      { area: 'Altstadt', year: 2022, value: 1213, unit: 'persons', category: 'total' },
      { area: 'Altstadt', year: 2023, value: 1220, unit: 'persons', category: 'total' },
    ],
  },
  {
    indicator: 'households',
    rows: [
      { area: 'Altstadt', year: 2023, value: 810, unit: 'households', category: 'total' },
      { area: 'Altstadt', year: 2023, value: 505, unit: 'households', category: 'single_person' },
    ],
  },
  {
    indicator: 'area_hectares',
    rows: [
      { area: 'Altstadt', year: 2019, value: 35.0987, unit: 'hectares', category: 'total' },
      { area: 'Altstadt', year: 2020, value: 35.0987, unit: 'hectares', category: 'total' },
    ],
  },
  {
    indicator: 'unemployed_count',
    rows: [
      { area: 'Altstadt', year: 2022, value: 14, unit: 'persons', category: 'total' },
      { area: 'Altstadt', year: 2023, value: 16, unit: 'persons', category: 'total' },
    ],
  },
  {
    indicator: 'unemployed_rate',
    rows: [
      { area: 'Altstadt', year: 2018, value: 2.3, unit: 'percent', category: 'total' },
      { area: 'Altstadt', year: 2019, value: 1.6, unit: 'percent', category: 'total' },
    ],
  },
  {
    indicator: 'foreign_count',
    rows: [
      { area: 'Altstadt', year: 2022, value: 214, unit: 'persons', category: 'total' },
      { area: 'Altstadt', year: 2023, value: 212, unit: 'persons', category: 'total' },
    ],
  },
];

export const TIMESERIES_CATEGORY_CASES: TimeseriesCategoryCase[] = [
  {
    indicator: 'households',
    category: 'single_person',
    rows: [
      { area: 'Altstadt', year: 2023, value: 505, unit: 'households', category: 'single_person' },
    ],
  },
  {
    indicator: 'gender',
    category: 'male',
    rows: [{ area: 'Altstadt', year: 2023, value: 638, unit: 'persons', category: 'male' }],
  },
  {
    indicator: 'age_groups',
    category: 'age_0_2',
    rows: [{ area: 'Altstadt', year: 2023, value: 19, unit: 'persons', category: 'age_0_2' }],
  },
  {
    indicator: 'religion',
    category: 'evangelical',
    rows: [{ area: 'Altstadt', year: 2023, value: 344, unit: 'persons', category: 'evangelical' }],
  },
  {
    indicator: 'foreign_nationalities_selected',
    category: 'turkey',
    rows: [{ area: 'Altstadt', year: 2023, value: 8, unit: 'persons', category: 'turkey' }],
  },
  {
    indicator: 'foreign_age_groups',
    category: 'age_0_2',
    rows: [{ area: 'Altstadt', year: 2023, value: 4, unit: 'persons', category: 'age_0_2' }],
  },
  {
    indicator: 'foreign_gender',
    category: 'male',
    rows: [{ area: 'Altstadt', year: 2023, value: 127, unit: 'persons', category: 'male' }],
  },
  {
    indicator: 'migrant_gender',
    category: 'male',
    rows: [{ area: 'Altstadt', year: 2023, value: 199, unit: 'persons', category: 'male' }],
  },
];

export const AREAS_SAME_DISTRICTS: string[] = [
  'marital_status',
  'gender',
  'age_groups',
  'area_hectares',
  'unemployed_count',
  'unemployed_rate',
  'religion',
  'foreign_nationalities_selected',
  'foreign_age_groups',
  'foreign_gender',
  'foreign_count',
  'migrant_gender',
];

export const CATEGORIES_CASES: CategoriesCase[] = [
  { indicator: 'households', rows: ['single_person', 'total'] },
  { indicator: 'marital_status', rows: ['divorced', 'married', 'single', 'total', 'widowed'] },
  { indicator: 'gender', rows: ['female', 'male', 'total'] },
  {
    indicator: 'age_groups',
    rows: [
      'age_0_2',
      'age_10_11',
      'age_12_14',
      'age_15_17',
      'age_18_20',
      'age_21_24',
      'age_25_29',
      'age_30_34',
      'age_35_39',
      'age_3_5',
      'age_40_44',
      'age_45_49',
      'age_50_54',
      'age_55_59',
      'age_60_64',
      'age_65_69',
      'age_6_9',
      'age_70_74',
      'age_75_79',
      'age_80_plus',
      'total',
    ],
  },
  { indicator: 'area_hectares', rows: ['total'] },
  { indicator: 'unemployed_count', rows: ['total'] },
  { indicator: 'unemployed_rate', rows: ['total'] },
  { indicator: 'religion', rows: ['catholic', 'evangelical', 'other_or_none', 'total'] },
  {
    indicator: 'foreign_nationalities_selected',
    rows: ['bulgaria', 'iraq', 'poland', 'russia', 'syria', 'total', 'turkey', 'ukraine'],
  },
  {
    indicator: 'foreign_age_groups',
    rows: [
      'age_0_2',
      'age_10_11',
      'age_12_14',
      'age_15_17',
      'age_18_20',
      'age_21_24',
      'age_25_29',
      'age_30_34',
      'age_35_39',
      'age_3_5',
      'age_40_44',
      'age_45_49',
      'age_50_54',
      'age_55_59',
      'age_60_64',
      'age_65_69',
      'age_6_9',
      'age_70_74',
      'age_75_79',
      'age_80_plus',
      'total',
    ],
  },
  { indicator: 'foreign_gender', rows: ['female', 'male', 'total'] },
  { indicator: 'foreign_count', rows: ['total'] },
  { indicator: 'migrant_gender', rows: ['female', 'male', 'total'] },
];

export const RANKING_UNFILTERED_CASES: RankingUnfilteredCase[] = [
  {
    indicator: 'population',
    year: 2023,
    rows: [
      { area: 'Gaarden-Ost', value: 18000, unit: 'persons', category: 'total' },
      { area: 'Schreventeich', value: 9000, unit: 'persons', category: 'total' },
    ],
  },
  {
    indicator: 'households',
    year: 2023,
    rows: [
      { area: 'Gaarden-Ost', value: 6050, unit: 'households', category: 'total' },
      { area: 'Gaarden-Ost', value: 3220, unit: 'households', category: 'single_person' },
    ],
  },
  {
    indicator: 'area_hectares',
    year: 2020,
    rows: [
      { area: 'Vorstadt', value: 45.8515, unit: 'hectares', category: 'total' },
      { area: 'Altstadt', value: 35.0987, unit: 'hectares', category: 'total' },
    ],
  },
  {
    indicator: 'unemployed_count',
    year: 2023,
    rows: [
      { area: 'Vorstadt', value: 43, unit: 'persons', category: 'total' },
      { area: 'Altstadt', value: 16, unit: 'persons', category: 'total' },
    ],
  },
  {
    indicator: 'unemployed_rate',
    year: 2019,
    rows: [
      { area: 'Vorstadt', value: 4.2, unit: 'percent', category: 'total' },
      { area: 'Altstadt', value: 1.6, unit: 'percent', category: 'total' },
    ],
  },
  {
    indicator: 'foreign_count',
    year: 2023,
    rows: [
      { area: 'Vorstadt', value: 324, unit: 'persons', category: 'total' },
      { area: 'Altstadt', value: 212, unit: 'persons', category: 'total' },
    ],
  },
];

export const RANKING_CATEGORY_CASES: RankingCategoryCase[] = [
  {
    indicator: 'gender',
    year: 2023,
    category: 'male',
    rows: [
      { area: 'Vorstadt', value: 829, unit: 'persons', category: 'male' },
      { area: 'Altstadt', value: 638, unit: 'persons', category: 'male' },
    ],
  },
  {
    indicator: 'age_groups',
    year: 2023,
    category: 'age_80_plus',
    rows: [
      { area: 'Altstadt', value: 153, unit: 'persons', category: 'age_80_plus' },
      { area: 'Vorstadt', value: 115, unit: 'persons', category: 'age_80_plus' },
    ],
  },
  {
    indicator: 'foreign_nationalities_selected',
    year: 2023,
    category: 'ukraine',
    rows: [
      { area: 'Altstadt', value: 21, unit: 'persons', category: 'ukraine' },
      { area: 'Vorstadt', value: 16, unit: 'persons', category: 'ukraine' },
    ],
  },
  {
    indicator: 'foreign_age_groups',
    year: 2023,
    category: 'age_80_plus',
    rows: [
      { area: 'Vorstadt', value: 7, unit: 'persons', category: 'age_80_plus' },
      { area: 'Altstadt', value: 3, unit: 'persons', category: 'age_80_plus' },
    ],
  },
  {
    indicator: 'foreign_gender',
    year: 2023,
    category: 'female',
    rows: [
      { area: 'Vorstadt', value: 164, unit: 'persons', category: 'female' },
      { area: 'Altstadt', value: 85, unit: 'persons', category: 'female' },
    ],
  },
  {
    indicator: 'migrant_gender',
    year: 2023,
    category: 'female',
    rows: [
      { area: 'Vorstadt', value: 265, unit: 'persons', category: 'female' },
      { area: 'Altstadt', value: 165, unit: 'persons', category: 'female' },
    ],
  },
];
