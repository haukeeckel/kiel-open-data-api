import { describe, expect, it } from 'vitest';

import { toAreasQuery, toRankingQuery, toTimeseriesQuery } from './statistics.mapper.js';

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
});
