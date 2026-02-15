import { type DatasetConfig } from './types.js';

export const SUBDISTRICTS_POPULATION: DatasetConfig = {
  id: 'subdistricts_population',
  csvFilename: 'kiel_bevoelkerung_ortsteile.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_ortsteile.csv',
  areaType: 'subdistrict',
  areaColumn: 'Ortsteil',
  areaExpression: 'TRIM("Ortsteil")',
  format: {
    type: 'unpivot_years',
    indicatorColumn: 'Merkmal',
    yearPattern: /^\d{4}(?:_\d+)?$/,
    yearParser: (raw) => Number(raw.match(/^\d{4}/)?.[0] ?? Number.NaN),
    rows: [
      {
        filterValue: 'Einwohner insgesamt',
        indicator: 'population',
        unit: 'persons',
        category: {
          slug: 'total',
          label: 'Einwohner insgesamt',
        },
      },
    ],
  },
};
