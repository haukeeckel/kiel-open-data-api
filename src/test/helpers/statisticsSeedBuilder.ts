import type { StatisticsSeedRow } from '../fixtures/statisticsSeed.js';

export type StatisticsInsertStatement = {
  sql: string;
  params: Array<number | string>;
};

export function buildStatisticsInsert(
  rows: readonly StatisticsSeedRow[],
): StatisticsInsertStatement {
  if (rows.length === 0) {
    throw new Error('Cannot build statistics seed insert without rows');
  }

  const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',\n      ');
  const sql = `
      INSERT INTO statistics (indicator, area_type, area_name, year, value, unit, category) VALUES
      ${placeholders};
    `;

  const params: Array<number | string> = [];
  for (const row of rows) {
    params.push(
      row.indicator,
      row.areaType,
      row.areaName,
      row.year,
      row.value,
      row.unit,
      row.category,
    );
  }

  return { sql, params };
}
