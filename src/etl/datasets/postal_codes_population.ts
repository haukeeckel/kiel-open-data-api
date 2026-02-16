import { type DatasetConfig } from './types.js';

export const POSTAL_CODES_POPULATION: DatasetConfig = {
  id: 'postal_codes_population',
  csvFilename: 'kiel_bevoelkerung_in_den_kieler_plz_bezirken.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_in_den_kieler_plz_bezirken.csv',
  csvReadOptions: {
    quote: '"',
    escape: '"',
    strictMode: false,
    nullPadding: true,
  },
  columnAliases: {
    'PLZ-Bereich': ['PLZ-\nBereich', 'PLZ- Bereich', 'PLZ Bereich'],
  },
  areaType: 'postal_code',
  areaColumn: 'PLZ-Bereich',
  areaExpression: 'TRIM(CAST("PLZ-Bereich" AS VARCHAR))',
  format: {
    type: 'unpivot_years',
    indicatorColumn: 'Merkmal',
    rows: [
      {
        filterValue: 'Jahr',
        indicator: 'population',
        unit: 'persons',
        valueExpression: "REPLACE(value, '.', '')",
        category: {
          slug: 'total',
          label: 'Einwohner insgesamt',
        },
      },
    ],
  },
};
