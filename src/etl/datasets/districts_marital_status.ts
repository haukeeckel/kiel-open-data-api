import { type DatasetConfig } from './types.js';

export const DISTRICTS_MARITAL_STATUS: DatasetConfig = {
  id: 'districts_marital_status',
  csvFilename: 'kiel_bevoelkerung_einwohner_nach_familienstand_in_den_stadtteilen.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_einwohner_nach_familienstand_in_den_stadtteilen.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Jahr',
    yearParser: (value) => {
      const year = value.match(/\d{4}/)?.[0];
      return year ? Number(year) : Number.NaN;
    },
    indicator: 'district_marital_status',
    unit: 'persons',
    columns: [
      {
        valueExpression:
          'COALESCE("ledig", 0) + COALESCE("verheiratet", 0) + COALESCE("verwitwet", 0) + COALESCE("geschieden", 0)',
        category: { slug: 'total', label: 'Insgesamt (berechnet)' },
      },
      {
        valueColumn: 'ledig',
        category: { slug: 'single', label: 'Ledig' },
      },
      {
        valueColumn: 'verheiratet',
        category: { slug: 'married', label: 'Verheiratet' },
      },
      {
        valueColumn: 'verwitwet',
        category: { slug: 'widowed', label: 'Verwitwet' },
      },
      {
        valueColumn: 'geschieden',
        category: { slug: 'divorced', label: 'Geschieden' },
      },
    ],
  },
};
