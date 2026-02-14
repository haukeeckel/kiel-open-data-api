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
      area: 'Altstadt',
    } as const;

    expect(toTimeseriesQuery(input)).toEqual(input);
  });

  it('maps timeseries query with range', () => {
    const input = {
      indicator: 'population',
      areaType: 'district',
      area: 'Altstadt',
      from: 2020,
      to: 2023,
    } as const;

    expect(toTimeseriesQuery(input)).toEqual(input);
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
