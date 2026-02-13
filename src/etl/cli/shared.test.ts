import { describe, expect, it } from 'vitest';

import { DISTRICTS_POPULATION } from '../datasets/districts_population.js';

import { buildUsage, parseCliArgs, resolveDatasetsFromArg } from './shared.js';

describe('etl cli shared parser', () => {
  it('resolves --all dataset selector', () => {
    const result = parseCliArgs(['--all'], { scriptName: 'fetch.ts' });
    expect(result.datasets.length).toBeGreaterThan(1);
    expect(result.numericFlags).toEqual({});
  });

  it('resolves single dataset selector', () => {
    const result = parseCliArgs([DISTRICTS_POPULATION.id], { scriptName: 'fetch.ts' });
    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0]?.id).toBe(DISTRICTS_POPULATION.id);
  });

  it('throws for unknown dataset id', () => {
    expect(() => resolveDatasetsFromArg('not-a-dataset')).toThrow(/Unknown dataset id/i);
  });

  it('accepts numeric flags in both forms', () => {
    const result = parseCliArgs(
      [
        DISTRICTS_POPULATION.id,
        '--retries',
        '7',
        '--base-delay-ms=100',
        '--max-delay-ms',
        '200',
        '--timeout-ms=300',
      ],
      {
        scriptName: 'fetch.ts',
        numericFlags: ['retries', 'base-delay-ms', 'max-delay-ms', 'timeout-ms'],
      },
    );

    expect(result.numericFlags).toEqual({
      retries: 7,
      'base-delay-ms': 100,
      'max-delay-ms': 200,
      'timeout-ms': 300,
    });
  });

  it('rejects unknown flags', () => {
    expect(() =>
      parseCliArgs([DISTRICTS_POPULATION.id, '--oops', '1'], {
        scriptName: 'fetch.ts',
        numericFlags: ['retries'],
      }),
    ).toThrow(/Unknown option --oops/i);
  });

  it('rejects non-positive or non-numeric flag values', () => {
    expect(() =>
      parseCliArgs([DISTRICTS_POPULATION.id, '--retries', '0'], {
        scriptName: 'fetch.ts',
        numericFlags: ['retries'],
      }),
    ).toThrow(/expected positive integer/i);

    expect(() =>
      parseCliArgs([DISTRICTS_POPULATION.id, '--retries', 'abc'], {
        scriptName: 'fetch.ts',
        numericFlags: ['retries'],
      }),
    ).toThrow(/expected positive integer/i);
  });

  it('throws usage when selector is missing', () => {
    expect(() =>
      parseCliArgs(['--retries', '2'], {
        scriptName: 'fetch.ts',
        numericFlags: ['retries'],
      }),
    ).toThrow(buildUsage('fetch.ts', ['retries']));
  });
});
