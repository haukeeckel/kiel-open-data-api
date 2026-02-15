import { type DatasetConfig } from './types.js';

export const SUBDISTRICTS_GENDER: DatasetConfig = {
  id: 'subdistricts_gender',
  csvFilename: 'kiel_bevoelkerung_geschlecht_ortsteile.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_geschlecht_ortsteile.csv',
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
