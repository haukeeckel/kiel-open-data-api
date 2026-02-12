import { type DatasetConfig } from './types.js';

export const DISTRICTS_RELIGION: DatasetConfig = {
  id: 'districts_religion',
  csvFilename: 'kiel_bevoelkerung_einwohner_nach_religionszugehoerigkeit_in_den_stadtteilen.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_einwohner_nach_religionszugehoerigkeit_in_den_stadtteilen.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Jahr',
    indicator: 'religion',
    unit: 'persons',
    columns: [
      {
        valueExpression:
          'COALESCE("evangelisch", 0) + COALESCE("katholisch", 0) + COALESCE("sonstige/ohne", 0)',
        category: { slug: 'total', label: 'Insgesamt (berechnet)' },
      },
      {
        valueColumn: 'evangelisch',
        category: { slug: 'evangelical', label: 'Evangelisch' },
      },
      {
        valueColumn: 'katholisch',
        category: { slug: 'catholic', label: 'Katholisch' },
      },
      {
        valueColumn: 'sonstige/ohne',
        category: { slug: 'other_or_none', label: 'Sonstige/ohne' },
      },
    ],
  },
};
