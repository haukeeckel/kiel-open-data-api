import { type DatasetConfig } from './types.js';

export const DISTRICTS_UNEMPLOYED_RATE: DatasetConfig = {
  id: 'districts_unemployed_rate',
  csvFilename: 'kiel_wirtschaft_arbeit_arbeitslose_betroffenheitsquote_stadtteile.csv',
  url: 'https://www.kiel.de/opendata/kiel_wirtschaft_arbeit_arbeitslose_betroffenheitsquote_stadtteile.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  format: {
    type: 'unpivot_years',
    indicatorColumn: 'Merkmal',
    yearPattern: /^\d{2}\.\d{2}\.\d{4}$/,
    yearParser: (value) => {
      const year = value.match(/\d{4}/)?.[0];
      return year ? Number(year) : Number.NaN;
    },
    rows: [
      {
        filterValue: 'Betroffenheitsquote',
        indicator: 'unemployed_rate',
        unit: 'percent',
        valueExpression: "REPLACE(value, ',', '.')",
        category: { slug: 'total', label: 'Betroffenheitsquote' },
      },
    ],
  },
};
