import { DISTRICTS_AGE_GROUPS } from './districts_age_groups.js';
import { DISTRICTS_AREA_HECTARES } from './districts_area_hectares.js';
import { DISTRICTS_FOREIGN_AGE_GROUPS } from './districts_foreign_age_groups.js';
import { DISTRICTS_FOREIGN_COUNT } from './districts_foreign_count.js';
import { DISTRICTS_FOREIGN_GENDER } from './districts_foreign_gender.js';
import { DISTRICTS_FOREIGN_NATIONALITIES_SELECTED } from './districts_foreign_nationalities_selected.js';
import { DISTRICTS_GENDER } from './districts_gender.js';
import { DISTRICTS_HOUSEHOLDS_TYPE_SIZE } from './districts_households_type_size.js';
import { DISTRICTS_MARITAL_STATUS } from './districts_marital_status.js';
import { DISTRICTS_MIGRANT_GENDER } from './districts_migrant_gender.js';
import { DISTRICTS_POPULATION } from './districts_population.js';
import { DISTRICTS_RELIGION } from './districts_religion.js';
import { DISTRICTS_UNEMPLOYED_COUNT } from './districts_unemployed_count.js';
import { DISTRICTS_UNEMPLOYED_RATE } from './districts_unemployed_rate.js';
import { SUBDISTRICTS_AGE_GROUPS } from './subdistricts_age_groups.js';
import { SUBDISTRICTS_FOREIGN_GENDER } from './subdistricts_foreign_gender.js';
import { SUBDISTRICTS_GENDER } from './subdistricts_gender.js';
import { SUBDISTRICTS_MIGRANT_GENDER } from './subdistricts_migrant_gender.js';
import { SUBDISTRICTS_POPULATION } from './subdistricts_population.js';

import type { DatasetConfig } from './types.js';

export const DATASET_MANIFEST: readonly DatasetConfig[] = [
  DISTRICTS_POPULATION,
  DISTRICTS_HOUSEHOLDS_TYPE_SIZE,
  DISTRICTS_MARITAL_STATUS,
  DISTRICTS_GENDER,
  DISTRICTS_FOREIGN_AGE_GROUPS,
  DISTRICTS_FOREIGN_COUNT,
  DISTRICTS_FOREIGN_GENDER,
  DISTRICTS_FOREIGN_NATIONALITIES_SELECTED,
  DISTRICTS_AGE_GROUPS,
  DISTRICTS_AREA_HECTARES,
  DISTRICTS_MIGRANT_GENDER,
  DISTRICTS_UNEMPLOYED_COUNT,
  DISTRICTS_UNEMPLOYED_RATE,
  DISTRICTS_RELIGION,
  SUBDISTRICTS_POPULATION,
  SUBDISTRICTS_AGE_GROUPS,
  SUBDISTRICTS_GENDER,
  SUBDISTRICTS_FOREIGN_GENDER,
  SUBDISTRICTS_MIGRANT_GENDER,
];

export function validateDatasetManifest(datasets: readonly DatasetConfig[]): void {
  const seenIds = new Set<string>();

  for (const dataset of datasets) {
    if (!dataset.id.trim()) {
      throw new Error('Dataset manifest entry has empty id');
    }
    if (!dataset.url.trim()) {
      throw new Error(`Dataset ${dataset.id} has empty url`);
    }
    if (!dataset.csvFilename.trim()) {
      throw new Error(`Dataset ${dataset.id} has empty csvFilename`);
    }
    if (seenIds.has(dataset.id)) {
      throw new Error(`Duplicate dataset id in manifest: ${dataset.id}`);
    }
    seenIds.add(dataset.id);
  }
}

export function buildDatasetManifestIndex(
  datasets: readonly DatasetConfig[],
): ReadonlyMap<string, DatasetConfig> {
  validateDatasetManifest(datasets);
  return new Map(datasets.map((dataset) => [dataset.id, dataset]));
}
