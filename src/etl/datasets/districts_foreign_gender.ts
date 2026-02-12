import { type DatasetConfig } from './types.js';

export const DISTRICTS_FOREIGN_GENDER: DatasetConfig = {
  id: 'districts_foreign_gender',
  csvFilename: 'kiel_bevoelkerung_stadtteile_auslaendisch_geschlecht.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_stadtteile_auslaendisch_geschlecht.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  areaExpression: 'TRIM("Stadtteil")',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Datum',
    yearParser: (value) => {
      const year = value.match(/\d{4}/)?.[0];
      return year ? Number(year) : Number.NaN;
    },
    dedupeByAreaYearKeepLast: true,
    filterColumn: 'Merkmal',
    filterValue: 'Auslaender',
    indicator: 'foreign_gender',
    unit: 'persons',
    columns: [
      {
        valueColumn: 'insgesamt',
        category: { slug: 'total', label: 'Auslaender insgesamt' },
      },
      {
        valueColumn: 'maennlich',
        category: { slug: 'male', label: 'Auslaender maennlich' },
      },
      {
        valueColumn: 'weiblich',
        category: { slug: 'female', label: 'Auslaender weiblich' },
      },
    ],
  },
};
