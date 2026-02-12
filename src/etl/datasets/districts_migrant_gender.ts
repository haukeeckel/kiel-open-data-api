import { type DatasetConfig } from './types.js';

export const DISTRICTS_MIGRANT_GENDER: DatasetConfig = {
  id: 'districts_migrant_gender',
  csvFilename: 'kiel_bevoelkerung_stadtteile_einwohner_mit_migrationshintergrund_geschlecht.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_stadtteile_einwohner_mit_migrationshintergrund_geschlecht.csv',
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
    filterValue: 'Einwohner mit Migrationshintergrund',
    indicator: 'migrant_gender',
    unit: 'persons',
    columns: [
      {
        valueColumn: 'insgesamt',
        category: { slug: 'total', label: 'Einwohner mit Migrationshintergrund insgesamt' },
      },
      {
        valueColumns: ['männlich', 'm�nnlich', 'maennlich'],
        category: { slug: 'male', label: 'Maennlich' },
      },
      {
        valueColumn: 'weiblich',
        category: { slug: 'female', label: 'Weiblich' },
      },
    ],
  },
};
