import { type DatasetConfig } from './types.js';

export const SUBDISTRICTS_FOREIGN_GENDER: DatasetConfig = {
  id: 'subdistricts_foreign_gender',
  csvFilename: 'kiel_bevoelkerung_auslaendisch_ortsteile.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_auslaendisch_ortsteile.csv',
  areaType: 'subdistrict',
  areaColumn: 'Ortsteil',
  areaExpression: 'TRIM("Ortsteil")',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Datum',
    dedupeByAreaYearKeepLast: true,
    yearParser: (value) => {
      const year = value.match(/\d{4}/)?.[0];
      return year ? Number(year) : Number.NaN;
    },
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
