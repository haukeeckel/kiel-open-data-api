import { type DatasetConfig } from './types.js';

export const SUBDISTRICTS_AGE_GROUPS: DatasetConfig = {
  id: 'subdistricts_age_groups',
  csvFilename: 'kiel_bevoelkerung_altersgruppen_ortsteile.csv',
  url: 'https://www.kiel.de/opendata/kiel_bevoelkerung_altersgruppen_ortsteile.csv',
  areaType: 'subdistrict',
  areaColumn: 'Ortsteil',
  areaExpression: 'TRIM("Ortsteil")',
  format: {
    type: 'unpivot_categories',
    yearColumn: 'Datum',
    yearParser: (value) => {
      const year = value.match(/\d{4}/)?.[0];
      return year ? Number(year) : Number.NaN;
    },
    filterColumn: 'Merkmal',
    filterValue: 'Einwohner nach Altersgruppen',
    dedupeByAreaYearKeepLast: true,
    indicator: 'age_groups',
    unit: 'persons',
    columns: [
      {
        valueExpression:
          'COALESCE("0-<5", 0) + COALESCE("5-<10", 0) + COALESCE("10-<15", 0) + COALESCE("15-<20", 0) + COALESCE("20-<25", 0) + COALESCE("25-<30", 0) + COALESCE("30-<35", 0) + COALESCE("35-<40", 0) + COALESCE("40-<45", 0) + COALESCE("45-<50", 0) + COALESCE("50-<55", 0) + COALESCE("55-<60", 0) + COALESCE("60-<65", 0) + COALESCE("65-<70", 0) + COALESCE("70-<75", 0) + COALESCE("75-<80", 0) + COALESCE("80-<85", 0) + COALESCE("85 und Aelter", 0)',
        category: { slug: 'total', label: 'Einwohner nach Altersgruppen insgesamt (berechnet)' },
      },
      { valueColumn: '0-<5', category: { slug: 'age_0_4', label: '0-<5' } },
      { valueColumn: '5-<10', category: { slug: 'age_5_9', label: '5-<10' } },
      { valueColumn: '10-<15', category: { slug: 'age_10_14', label: '10-<15' } },
      { valueColumn: '15-<20', category: { slug: 'age_15_19', label: '15-<20' } },
      { valueColumn: '20-<25', category: { slug: 'age_20_24', label: '20-<25' } },
      { valueColumn: '25-<30', category: { slug: 'age_25_29', label: '25-<30' } },
      { valueColumn: '30-<35', category: { slug: 'age_30_34', label: '30-<35' } },
      { valueColumn: '35-<40', category: { slug: 'age_35_39', label: '35-<40' } },
      { valueColumn: '40-<45', category: { slug: 'age_40_44', label: '40-<45' } },
      { valueColumn: '45-<50', category: { slug: 'age_45_49', label: '45-<50' } },
      { valueColumn: '50-<55', category: { slug: 'age_50_54', label: '50-<55' } },
      { valueColumn: '55-<60', category: { slug: 'age_55_59', label: '55-<60' } },
      { valueColumn: '60-<65', category: { slug: 'age_60_64', label: '60-<65' } },
      { valueColumn: '65-<70', category: { slug: 'age_65_69', label: '65-<70' } },
      { valueColumn: '70-<75', category: { slug: 'age_70_74', label: '70-<75' } },
      { valueColumn: '75-<80', category: { slug: 'age_75_79', label: '75-<80' } },
      { valueColumn: '80-<85', category: { slug: 'age_80_84', label: '80-<85' } },
      { valueColumn: '85 und Aelter', category: { slug: 'age_85_plus', label: '85 und Aelter' } },
    ],
  },
};
