import { type DatasetConfig } from './types.js';

export const SUBDISTRICTS_MIGRANT_GENDER: DatasetConfig = {
  id: 'subdistricts_migrant_gender',
  csvFilename: 'kiel_bevoelkerung_ortsteile_einwohner_mit_migrationshintergrund.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_ortsteile_einwohner_mit_migrationshintergrund.csv',
  csvReadOptions: {
    fallbackEncodings: ['latin-1'],
  },
  areaType: 'subdistrict',
  areaColumn: 'Ortsteil',
  areaExpression: 'TRIM("Ortsteil")',
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
        valueColumns: ['m\u00e4nnlich', 'mÃ¤nnlich', 'm\ufffdnnlich', 'maennlich'],
        category: { slug: 'male', label: 'Maennlich' },
      },
      {
        valueColumn: 'weiblich',
        category: { slug: 'female', label: 'Weiblich' },
      },
    ],
  },
};
