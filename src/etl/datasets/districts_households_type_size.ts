import { type DatasetConfig } from './types.js';

export const DISTRICTS_HOUSEHOLDS_TYPE_SIZE: DatasetConfig = {
  id: 'districts_households_type_size',
  csvFilename:
    'kiel_bevoelkerung_haushalte_nach_haushaltstypen_und_personenanzahl_in_den_stadtteilen.csv',
  url: `https://www.kiel.de/opendata/kiel_bevoelkerung_haushalte_nach_haushaltstypen_und_personenanzahl_in_den_stadtteilen.csv`,
  areaType: 'district',
  areaColumn: 'Stadtteile',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Jahr',
    yearParser: (value) => {
      const year = value.match(/\d{4}/)?.[0];
      return year ? Number(year) : Number.NaN;
    },
    filterColumn: 'Merkmal',
    filterValue: 'Haushalte',
    indicator: 'households',
    unit: 'households',
    columns: [
      {
        valueExpression:
          'COALESCE("Einpersonen", 0) + COALESCE("Paar ohne Kind", 0) + COALESCE("Paar mit Kindern", 0) + COALESCE("Paar mit Nachkommen", 0) + COALESCE("Alleinerziehende", 0) + COALESCE("Sonst. Mehrpersonenhaushalte", 0)',
        category: { slug: 'total', label: 'Haushalte insgesamt (berechnet)' },
      },
      {
        valueColumn: 'Einpersonen',
        category: { slug: 'single_person', label: 'Einpersonenhaushalte' },
      },
      {
        valueColumn: 'Paar ohne Kind',
        category: { slug: 'couple_no_children', label: 'Paar ohne Kind' },
      },
      {
        valueColumn: 'Paar mit Kindern',
        category: { slug: 'couple_with_children', label: 'Paar mit Kindern' },
      },
      {
        valueColumn: 'Paar mit Nachkommen',
        category: { slug: 'couple_with_descendants', label: 'Paar mit Nachkommen' },
      },
      {
        valueColumn: 'Alleinerziehende',
        category: { slug: 'single_parent', label: 'Alleinerziehende' },
      },
      {
        valueColumn: 'Sonst. Mehrpersonenhaushalte',
        category: { slug: 'other_multi_person', label: 'Sonst. Mehrpersonenhaushalte' },
      },
    ],
  },
};
