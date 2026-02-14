import { DATASET_MANIFEST, buildDatasetManifestIndex } from './manifest.js';

import type { DatasetConfig } from './types.js';

const DATASET_INDEX = buildDatasetManifestIndex(DATASET_MANIFEST);

export function getDataset(id: string): DatasetConfig {
  const dataset = DATASET_INDEX.get(id);

  if (dataset === undefined) {
    const known = getAllDatasetIds().join(', ');
    throw new Error(`Unknown dataset id: ${id}. Known dataset ids: ${known}`);
  }

  return dataset;
}

export function getAllDatasets(): readonly DatasetConfig[] {
  return DATASET_MANIFEST;
}

export function getAllDatasetIds(): readonly string[] {
  return [...DATASET_INDEX.keys()];
}
