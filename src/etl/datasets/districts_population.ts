import { type DatasetConfig } from './types.js';

export const DISTRICTS_POPULATION: DatasetConfig = {
  id: 'districts_population',
  csvFilename: 'kiel_bevoelkerung_stadtteile.csv',
  url: `https://www.kiel.de/de/kiel_zukunft/statistik_kieler_zahlen/open_data/kiel_bevoelkerung_stadtteile.csv`,
  areaType: 'district',
  areaColumn: 'Stadtteil',
  format: {
    type: 'unpivot_years',
    indicatorColumn: 'Merkmal',
    rows: [
      {
        filterValue: 'Einwohner insgesamt',
        indicator: 'population',
        unit: 'persons',
        category: 'total',
      },
    ],
  },
};
