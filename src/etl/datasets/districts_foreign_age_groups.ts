import { type DatasetConfig } from './types.js';

export const DISTRICTS_FOREIGN_AGE_GROUPS: DatasetConfig = {
  id: 'districts_foreign_age_groups',
  csvFilename: 'kiel_bevoelkerung_auslaendisch_altersgruppen_stadtteile.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_auslaendisch_altersgruppen_stadtteile.csv',
  areaType: 'district',
  areaColumn: 'Stadtteil',
  areaExpression: 'TRIM("Stadtteil")',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Datum',
    yearParser: (value) => {
      const year = value.match(/\d{4}/)?.[0];
      return year ? Number(year) : Number.NaN;
    },
    filterColumn: 'Merkmal',
    filterValue: 'Einwohner nach Altersgruppen',
    indicator: 'foreign_age_groups',
    unit: 'persons',
    columns: [
      {
        valueExpression:
          'COALESCE(TRY_CAST("0 bis unter 3" AS DOUBLE), 0) + COALESCE(TRY_CAST("3 bis unter 6" AS DOUBLE), 0) + COALESCE(TRY_CAST("6 bis unter 10" AS DOUBLE), 0) + COALESCE(TRY_CAST("10 bis unter 12" AS DOUBLE), 0) + COALESCE(TRY_CAST("12 bis unter 15" AS DOUBLE), 0) + COALESCE(TRY_CAST("15 bis unter 18" AS DOUBLE), 0) + COALESCE(TRY_CAST("18 bis unter 21" AS DOUBLE), 0) + COALESCE(TRY_CAST("21 bis unter 25" AS DOUBLE), 0) + COALESCE(TRY_CAST("25 bis unter 30" AS DOUBLE), 0) + COALESCE(TRY_CAST("30 bis unter 35" AS DOUBLE), 0) + COALESCE(TRY_CAST("35 bis unter 40" AS DOUBLE), 0) + COALESCE(TRY_CAST("40 bis unter 45" AS DOUBLE), 0) + COALESCE(TRY_CAST("45 bis unter 50" AS DOUBLE), 0) + COALESCE(TRY_CAST("50 bis unter 55" AS DOUBLE), 0) + COALESCE(TRY_CAST("55 bis unter 60" AS DOUBLE), 0) + COALESCE(TRY_CAST("60 bis unter 65" AS DOUBLE), 0) + COALESCE(TRY_CAST("65 bis unter 70" AS DOUBLE), 0) + COALESCE(TRY_CAST("70 bis unter 75" AS DOUBLE), 0) + COALESCE(TRY_CAST("75 bis unter 80" AS DOUBLE), 0) + COALESCE(TRY_CAST("80 und aelter" AS DOUBLE), 0)',
        category: {
          slug: 'total',
          label: 'Auslaendische Bevoelkerung nach Altersgruppen insgesamt (berechnet)',
        },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("0 bis unter 3" AS DOUBLE), 0)',
        category: { slug: 'age_0_2', label: '0 bis unter 3' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("3 bis unter 6" AS DOUBLE), 0)',
        category: { slug: 'age_3_5', label: '3 bis unter 6' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("6 bis unter 10" AS DOUBLE), 0)',
        category: { slug: 'age_6_9', label: '6 bis unter 10' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("10 bis unter 12" AS DOUBLE), 0)',
        category: { slug: 'age_10_11', label: '10 bis unter 12' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("12 bis unter 15" AS DOUBLE), 0)',
        category: { slug: 'age_12_14', label: '12 bis unter 15' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("15 bis unter 18" AS DOUBLE), 0)',
        category: { slug: 'age_15_17', label: '15 bis unter 18' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("18 bis unter 21" AS DOUBLE), 0)',
        category: { slug: 'age_18_20', label: '18 bis unter 21' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("21 bis unter 25" AS DOUBLE), 0)',
        category: { slug: 'age_21_24', label: '21 bis unter 25' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("25 bis unter 30" AS DOUBLE), 0)',
        category: { slug: 'age_25_29', label: '25 bis unter 30' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("30 bis unter 35" AS DOUBLE), 0)',
        category: { slug: 'age_30_34', label: '30 bis unter 35' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("35 bis unter 40" AS DOUBLE), 0)',
        category: { slug: 'age_35_39', label: '35 bis unter 40' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("40 bis unter 45" AS DOUBLE), 0)',
        category: { slug: 'age_40_44', label: '40 bis unter 45' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("45 bis unter 50" AS DOUBLE), 0)',
        category: { slug: 'age_45_49', label: '45 bis unter 50' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("50 bis unter 55" AS DOUBLE), 0)',
        category: { slug: 'age_50_54', label: '50 bis unter 55' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("55 bis unter 60" AS DOUBLE), 0)',
        category: { slug: 'age_55_59', label: '55 bis unter 60' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("60 bis unter 65" AS DOUBLE), 0)',
        category: { slug: 'age_60_64', label: '60 bis unter 65' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("65 bis unter 70" AS DOUBLE), 0)',
        category: { slug: 'age_65_69', label: '65 bis unter 70' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("70 bis unter 75" AS DOUBLE), 0)',
        category: { slug: 'age_70_74', label: '70 bis unter 75' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("75 bis unter 80" AS DOUBLE), 0)',
        category: { slug: 'age_75_79', label: '75 bis unter 80' },
      },
      {
        valueExpression: 'COALESCE(TRY_CAST("80 und aelter" AS DOUBLE), 0)',
        category: { slug: 'age_80_plus', label: '80 und aelter' },
      },
    ],
  },
};
