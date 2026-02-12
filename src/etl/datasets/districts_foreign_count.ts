import { type DatasetConfig } from './types.js';

export const DISTRICTS_FOREIGN_COUNT: DatasetConfig = {
  id: 'districts_foreign_count',
  csvFilename: 'kiel_bevoelkerung_stadtteile_auslaender.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_stadtteile_auslaender.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  areaExpression: 'TRIM("Stadtteil")',
  format: {
    type: 'unpivot_years',
    indicatorColumn: 'Merkmal',
    rows: [
      {
        filterValue: 'Auslaender',
        indicator: 'foreign_count',
        unit: 'persons',
        category: { slug: 'total', label: 'Auslaender' },
      },
    ],
  },
};
