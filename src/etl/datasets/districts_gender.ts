import { type DatasetConfig } from './types.js';

export const DISTRICTS_GENDER: DatasetConfig = {
  id: 'districts_gender',
  csvFilename: 'kiel_bevoelkerung_stadtteile_einwohner_geschlecht.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_stadtteile_einwohner_geschlecht.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Datum',
    yearParser: (value) => {
      const year = value.match(/\d{4}/)?.[0];
      return year ? Number(year) : Number.NaN;
    },
    filterColumn: 'Merkmal',
    filterValue: 'Einwohner insgesamt',
    indicator: 'gender',
    unit: 'persons',
    columns: [
      {
        valueColumn: 'insgesamt',
        category: { slug: 'total', label: 'Einwohner insgesamt' },
      },
      {
        valueColumn: 'maennlich',
        category: { slug: 'male', label: 'Maennlich' },
      },
      {
        valueColumn: 'weiblich',
        category: { slug: 'female', label: 'Weiblich' },
      },
    ],
  },
};
