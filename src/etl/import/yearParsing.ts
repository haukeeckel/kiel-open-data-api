import { quoteLiteral } from '../sql.js';

import { MAX_VALID_YEAR, MIN_VALID_YEAR } from './types.js';

export function parseYearOrThrow(args: {
  raw: string;
  parseYear: (value: string) => number;
  datasetId: string;
  formatType: 'unpivot_years' | 'unpivot_categories';
}): number {
  const parsed = args.parseYear(args.raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(
      `Invalid yearParser output for dataset ${args.datasetId} (${args.formatType}): ` +
        `input=${args.raw}, output=${String(parsed)}, allowedRange=${MIN_VALID_YEAR}..${MAX_VALID_YEAR}`,
    );
  }
  if (parsed < MIN_VALID_YEAR || parsed > MAX_VALID_YEAR) {
    throw new Error(
      `Invalid yearParser output for dataset ${args.datasetId} (${args.formatType}): ` +
        `input=${args.raw}, output=${String(parsed)}, allowedRange=${MIN_VALID_YEAR}..${MAX_VALID_YEAR}`,
    );
  }
  return parsed;
}

export function buildParsedYearCaseExpr(args: {
  datasetId: string;
  formatType: 'unpivot_years' | 'unpivot_categories';
  parser?: ((value: string) => number) | undefined;
  sourceAlias: 'year' | 'year_raw';
  rawValues: readonly string[];
}): string {
  const { datasetId, formatType, parser, sourceAlias, rawValues } = args;
  if (!parser) return sourceAlias;

  const cases = rawValues
    .map((raw) => {
      const parsed = parseYearOrThrow({
        raw,
        parseYear: parser,
        datasetId,
        formatType,
      });
      return `WHEN ${quoteLiteral(raw)} THEN ${String(parsed)}`;
    })
    .join(' ');
  return `CASE ${sourceAlias} ${cases} ELSE NULL END`;
}
