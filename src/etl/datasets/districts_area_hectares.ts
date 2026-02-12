import { type DatasetConfig } from './types.js';

export const DISTRICTS_AREA_HECTARES: DatasetConfig = {
  id: 'districts_area_hectares',
  csvFilename: 'kiel_geo_flaechen_stadtteile_in_hektar.csv',
  url: 'https://www.kiel.de/opendata/kiel_geo_flaechen_stadtteile_in_hektar.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Jahr',
    filterColumn: 'Merkmal',
    filterValue: 'Flaechen in Hektar',
    indicator: 'area_hectares',
    unit: 'hectares',
    columns: [
      {
        valueExpression: `REPLACE("Hektar", ',', '.')`,
        category: { slug: 'total', label: 'Flaechen in Hektar' },
      },
    ],
  },
};
