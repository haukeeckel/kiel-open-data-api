import { describe, expect, it } from 'vitest';

import {
  toAreasQuery,
  toCategoriesQuery,
  toIndicatorsQuery,
  toRankingQuery,
  toTimeseriesQuery,
  toYearsQuery,
} from './statistics.mapper.js';

describe('statistics mappers', () => {
  it('maps timeseries query and omits optional fields', () => {
    const input = {
      indicator: 'population',
      areaType: 'district',
      areas: 'Altstadt',
    } as const;

    expect(toTimeseriesQuery(input)).toEqual({
      indicator: 'population',
      areaType: 'district',
      areas: ['Altstadt'],
    });
  });

  it('maps timeseries query with range', () => {
    const input = {
      indicator: 'population',
      areaType: 'district',
      areas: 'Altstadt',
      from: 2020,
      to: 2023,
    } as const;

    expect(toTimeseriesQuery(input)).toEqual({
      indicator: 'population',
      areaType: 'district',
      areas: ['Altstadt'],
      from: 2020,
      to: 2023,
    });
  });

  it('maps timeseries CSV values with trim and dedup', () => {
    const input = {
      indicator: 'gender',
      areaType: 'district',
      areas: 'Altstadt, Gaarden-Ost,Altstadt',
      categories: 'male, female,male',
    } as const;

    expect(toTimeseriesQuery(input)).toEqual({
      indicator: 'gender',
      areaType: 'district',
      areas: ['Altstadt', 'Gaarden-Ost'],
      categories: ['male', 'female'],
    });
  });

  it('maps areas query and omits optional like', () => {
    const input = {
      indicator: 'population',
      areaType: 'district',
    } as const;

    expect(toAreasQuery(input)).toEqual(input);
  });

  it('maps areas query with like', () => {
    const input = {
      indicator: 'population',
      areaType: 'district',
      like: 'Alt',
    } as const;

    expect(toAreasQuery(input)).toEqual(input);
  });

  it('maps ranking query', () => {
    const input = {
      indicator: 'population',
      areaType: 'district',
      year: 2023,
      limit: 10,
      order: 'desc',
    } as const;

    expect(toRankingQuery(input)).toEqual(input);
  });

  it('maps ranking CSV values with trim and dedup', () => {
    const input = {
      indicator: 'gender',
      areaType: 'district',
      year: 2023,
      categories: 'male, female,male',
      areas: 'Altstadt, Gaarden-Ost,Altstadt',
      limit: 10,
      order: 'desc',
    } as const;

    expect(toRankingQuery(input)).toEqual({
      indicator: 'gender',
      areaType: 'district',
      year: 2023,
      categories: ['male', 'female'],
      areas: ['Altstadt', 'Gaarden-Ost'],
      limit: 10,
      order: 'desc',
    });
  });
  it('maps categories query', () => {
    const input = {
      indicator: 'households',
      areaType: 'district',
    } as const;

    expect(toCategoriesQuery(input)).toEqual(input);
  });

  it('maps empty years query', () => {
    const input = {} as const;

    expect(toYearsQuery(input)).toEqual({});
  });

  it('maps years query with optional filters', () => {
    const input = {
      indicator: 'population',
      areaType: 'district',
      category: 'total',
      area: 'Altstadt',
    } as const;

    expect(toYearsQuery(input)).toEqual(input);
  });

  it('maps indicators reverse-lookup query', () => {
    const input = {
      areaType: 'district',
      area: 'Altstadt',
      year: 2023,
    } as const;

    expect(toIndicatorsQuery(input)).toEqual(input);
  });
});
