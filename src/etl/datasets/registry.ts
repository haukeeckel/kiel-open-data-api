import { DISTRICTS_GENDER } from './districts_gender.js';
import { DISTRICTS_HOUSEHOLDS_TYPE_SIZE } from './districts_households_type_size.js';
import { DISTRICTS_MARITAL_STATUS } from './districts_marital_status.js';
import { DISTRICTS_POPULATION } from './districts_population.js';
import { type DatasetConfig } from './types.js';

const ALL_DATASETS: readonly DatasetConfig[] = [
  DISTRICTS_POPULATION,
  DISTRICTS_HOUSEHOLDS_TYPE_SIZE,
  DISTRICTS_MARITAL_STATUS,
  DISTRICTS_GENDER,
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
