import { type DatasetConfig } from './types.js';

export const DISTRICTS_AGE_GROUPS: DatasetConfig = {
  id: 'districts_age_groups',
  csvFilename: 'kiel_bevoelkerung_altersgruppen_stadtteile.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_altersgruppen_stadtteile.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Datum',
    yearParser: (value) => {
      const year = value.match(/\d{4}/)?.[0];
      return year ? Number(year) : Number.NaN;
    },
    filterColumn: 'Merkmal',
    filterValue: 'Einwohner nach Altersgruppen',
    indicator: 'age_groups',
    unit: 'persons',
    columns: [
      {
        valueExpression:
          'COALESCE("0 bis unter 3", 0) + COALESCE("3 bis unter 6", 0) + COALESCE("6 bis unter 10", 0) + COALESCE("10 bis unter 12", 0) + COALESCE("12 bis unter 15", 0) + COALESCE("15 bis unter 18", 0) + COALESCE("18 bis unter 21", 0) + COALESCE("21 bis unter 25", 0) + COALESCE("25 bis unter 30", 0) + COALESCE("30 bis unter 35", 0) + COALESCE("35 bis unter 40", 0) + COALESCE("40 bis unter 45", 0) + COALESCE("45 bis unter 50", 0) + COALESCE("50 bis unter 55", 0) + COALESCE("55 bis unter 60", 0) + COALESCE("60 bis unter 65", 0) + COALESCE("65 bis unter 70", 0) + COALESCE("70 bis unter 75", 0) + COALESCE("75 bis unter 80", 0) + COALESCE("80 und aelter", 0)',
        category: { slug: 'total', label: 'Einwohner nach Altersgruppen insgesamt (berechnet)' },
      },
      { valueColumn: '0 bis unter 3', category: { slug: 'age_0_2', label: '0 bis unter 3' } },
      { valueColumn: '3 bis unter 6', category: { slug: 'age_3_5', label: '3 bis unter 6' } },
      {
        valueColumn: '6 bis unter 10',
        category: { slug: 'age_6_9', label: '6 bis unter 10' },
      },
      {
        valueColumn: '10 bis unter 12',
        category: { slug: 'age_10_11', label: '10 bis unter 12' },
      },
      {
        valueColumn: '12 bis unter 15',
        category: { slug: 'age_12_14', label: '12 bis unter 15' },
      },
      {
        valueColumn: '15 bis unter 18',
        category: { slug: 'age_15_17', label: '15 bis unter 18' },
      },
      {
        valueColumn: '18 bis unter 21',
        category: { slug: 'age_18_20', label: '18 bis unter 21' },
      },
      {
        valueColumn: '21 bis unter 25',
        category: { slug: 'age_21_24', label: '21 bis unter 25' },
      },
      {
        valueColumn: '25 bis unter 30',
        category: { slug: 'age_25_29', label: '25 bis unter 30' },
      },
      {
        valueColumn: '30 bis unter 35',
        category: { slug: 'age_30_34', label: '30 bis unter 35' },
      },
      {
        valueColumn: '35 bis unter 40',
        category: { slug: 'age_35_39', label: '35 bis unter 40' },
      },
      {
        valueColumn: '40 bis unter 45',
        category: { slug: 'age_40_44', label: '40 bis unter 45' },
      },
      {
        valueColumn: '45 bis unter 50',
        category: { slug: 'age_45_49', label: '45 bis unter 50' },
      },
      {
        valueColumn: '50 bis unter 55',
        category: { slug: 'age_50_54', label: '50 bis unter 55' },
      },
      {
        valueColumn: '55 bis unter 60',
        category: { slug: 'age_55_59', label: '55 bis unter 60' },
      },
      {
        valueColumn: '60 bis unter 65',
        category: { slug: 'age_60_64', label: '60 bis unter 65' },
      },
      {
        valueColumn: '65 bis unter 70',
        category: { slug: 'age_65_69', label: '65 bis unter 70' },
      },
      {
        valueColumn: '70 bis unter 75',
        category: { slug: 'age_70_74', label: '70 bis unter 75' },
      },
      {
        valueColumn: '75 bis unter 80',
        category: { slug: 'age_75_79', label: '75 bis unter 80' },
      },
      {
        valueColumn: '80 und aelter',
        category: { slug: 'age_80_plus', label: '80 und aelter' },
      },
    ],
  },
};
