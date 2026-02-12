import { type DatasetConfig } from './types.js';

export const DISTRICTS_FOREIGN_NATIONALITIES_SELECTED: DatasetConfig = {
  id: 'districts_foreign_nationalities_selected',
  csvFilename:
    'kiel_bevoelkerung_auslaender_nach_ausgesuchten_nationalitaeten_in_den_stadtteilen.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_auslaender_nach_ausgesuchten_nationalitaeten_in_den_stadtteilen.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  areaExpression: 'TRIM("Stadtteil")',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Jahr',
    indicator: 'foreign_nationalities_selected',
    unit: 'persons',
    columns: [
      {
        valueExpression:
          'COALESCE(TRY_CAST("Tuerkei" AS DOUBLE), 0) + COALESCE(TRY_CAST("Polen" AS DOUBLE), 0) + COALESCE(TRY_CAST("Irak" AS DOUBLE), 0) + COALESCE(TRY_CAST("Russland" AS DOUBLE), 0) + COALESCE(TRY_CAST("Ukraine" AS DOUBLE), 0) + COALESCE(TRY_CAST("Syrien" AS DOUBLE), 0) + COALESCE(TRY_CAST("Bulgarien" AS DOUBLE), 0)',
        category: {
          slug: 'total',
          label: 'Ausgesuchte Nationalitaeten insgesamt (berechnet)',
        },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("Tuerkei" AS DOUBLE), 0)',
        category: { slug: 'turkey', label: 'Tuerkei' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("Polen" AS DOUBLE), 0)',
        category: { slug: 'poland', label: 'Polen' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("Irak" AS DOUBLE), 0)',
        category: { slug: 'iraq', label: 'Irak' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("Russland" AS DOUBLE), 0)',
        category: { slug: 'russia', label: 'Russland' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("Ukraine" AS DOUBLE), 0)',
        category: { slug: 'ukraine', label: 'Ukraine' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("Syrien" AS DOUBLE), 0)',
        category: { slug: 'syria', label: 'Syrien' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("Bulgarien" AS DOUBLE), 0)',
        category: { slug: 'bulgaria', label: 'Bulgarien' },
      },
    ],
  },
};
