import { DISTRICTS_AGE_GROUPS } from './districts_age_groups.js';
import { DISTRICTS_AREA_HECTARES } from './districts_area_hectares.js';
import { DISTRICTS_GENDER } from './districts_gender.js';
import { DISTRICTS_HOUSEHOLDS_TYPE_SIZE } from './districts_households_type_size.js';
import { DISTRICTS_MARITAL_STATUS } from './districts_marital_status.js';
import { DISTRICTS_POPULATION } from './districts_population.js';
import { DISTRICTS_RELIGION } from './districts_religion.js';
import { DISTRICTS_UNEMPLOYED_COUNT } from './districts_unemployed_count.js';
import { DISTRICTS_UNEMPLOYED_RATE } from './districts_unemployed_rate.js';
import { type DatasetConfig } from './types.js';

const ALL_DATASETS: readonly DatasetConfig[] = [
  DISTRICTS_POPULATION,
  DISTRICTS_HOUSEHOLDS_TYPE_SIZE,
  DISTRICTS_MARITAL_STATUS,
  DISTRICTS_GENDER,
  DISTRICTS_AGE_GROUPS,
  DISTRICTS_AREA_HECTARES,
  DISTRICTS_UNEMPLOYED_COUNT,
  DISTRICTS_UNEMPLOYED_RATE,
  DISTRICTS_RELIGION,
];

export function getDataset(id: string): DatasetConfig {
  const dataset = ALL_DATASETS.find((el) => el.id === id);

  if (dataset == undefined) {
    const known = ALL_DATASETS.map(({ id: datasetId }) => datasetId).join(', ');
    throw new Error(`Unknown dataset id: ${id}. Known dataset ids: ${known}`);
  }

  return dataset;
}

export function getAllDatasets(): readonly DatasetConfig[] {
  return ALL_DATASETS;
}

export function getAllDatasetIds(): readonly string[] {
  return ALL_DATASETS.map(({ id }) => id);
}
