import { pathToFileURL } from 'node:url';

import { getAllDatasetIds, getAllDatasets, getDataset } from '../datasets/registry.js';

import type { DatasetConfig } from '../datasets/types.js';

type ParseCliArgsSpec<TFlag extends string> = {
  scriptName: string;
  numericFlags?: readonly TFlag[];
};

type ParseCliArgsResult<TFlag extends string> = {
  datasets: readonly DatasetConfig[];
  numericFlags: Partial<Record<TFlag, number>>;
};

function usageFlags(flags: readonly string[]): string {
  if (flags.length === 0) return '';
  const parts = flags.map((flag) => `[--${flag} <n>]`);
  return ` ${parts.join(' ')}`;
}

export function buildUsage(scriptName: string, numericFlags: readonly string[] = []): string {
  return (
    `Usage: tsx src/etl/cli/${scriptName} <dataset-id> | --all${usageFlags(numericFlags)}\n` +
    `Known datasets: ${getAllDatasetIds().join(', ')}`
  );
}

export function resolveDatasetsFromArg(selector: string): readonly DatasetConfig[] {
  if (selector === '--all') return getAllDatasets();
  return [getDataset(selector)];
}

function parsePositiveInt(flagName: string, rawValue: string): number {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid value for --${flagName}: ${rawValue} (expected positive integer)`);
  }
  return value;
}

export function parseCliArgs<TFlag extends string>(
  argv: readonly string[],
  spec: ParseCliArgsSpec<TFlag>,
): ParseCliArgsResult<TFlag> {
  const numericFlags = spec.numericFlags ?? [];
  const allowedFlags = new Set<string>(numericFlags);
  const values: Partial<Record<TFlag, number>> = {};

  let selector: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg.startsWith('--')) {
      if (arg === '--all') {
        if (selector !== undefined) {
          throw new Error(buildUsage(spec.scriptName, numericFlags));
        }
        selector = arg;
        continue;
      }

      const token = arg.slice(2);
      const eqPos = token.indexOf('=');
      const hasInlineValue = eqPos >= 0;
      const flagName = hasInlineValue ? token.slice(0, eqPos) : token;
      if (!allowedFlags.has(flagName)) {
        throw new Error(
          `Unknown option --${flagName}\n${buildUsage(spec.scriptName, numericFlags)}`,
        );
      }

      let rawValue = hasInlineValue ? token.slice(eqPos + 1) : '';
      if (!hasInlineValue) {
        const next = argv[i + 1];
        if (next === undefined) {
          throw new Error(
            `Missing value for --${flagName}\n${buildUsage(spec.scriptName, numericFlags)}`,
          );
        }
        rawValue = next;
        i += 1;
      }

      values[flagName as TFlag] = parsePositiveInt(flagName, rawValue);
      continue;
    }

    if (selector !== undefined) {
      throw new Error(buildUsage(spec.scriptName, numericFlags));
    }
    selector = arg;
  }

  if (selector === undefined) {
    throw new Error(buildUsage(spec.scriptName, numericFlags));
  }

  return {
    datasets: resolveDatasetsFromArg(selector),
    numericFlags: values,
  };
}

export function isDirectCliEntry(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return importMetaUrl === pathToFileURL(entry).href;
}
