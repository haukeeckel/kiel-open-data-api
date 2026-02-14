import { describe, expect, it } from 'vitest';

import {
  DATASET_MANIFEST,
  buildDatasetManifestIndex,
  validateDatasetManifest,
} from './manifest.js';

describe('dataset manifest', () => {
  it('validates current manifest and builds index', () => {
    expect(() => validateDatasetManifest(DATASET_MANIFEST)).not.toThrow();
    const index = buildDatasetManifestIndex(DATASET_MANIFEST);
    expect(index.size).toBe(DATASET_MANIFEST.length);
  });

  it('rejects duplicate dataset ids', () => {
    const duplicate = [DATASET_MANIFEST[0], DATASET_MANIFEST[0]].filter(
      (dataset): dataset is NonNullable<(typeof DATASET_MANIFEST)[number]> => Boolean(dataset),
    );

    expect(() => validateDatasetManifest(duplicate)).toThrow(/duplicate dataset id/i);
  });

  it('rejects missing required fields', () => {
    const dataset = DATASET_MANIFEST[0];
    if (!dataset) throw new Error('Expected at least one manifest dataset');

    const broken = [{ ...dataset, csvFilename: '' }];

    expect(() => validateDatasetManifest(broken)).toThrow(/empty csvfilename/i);
  });
});
