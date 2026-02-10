export const STATISTICS_DDL = `
  CREATE TABLE IF NOT EXISTS statistics (
    indicator TEXT,
    area_type TEXT,
    area_name TEXT,
    year INTEGER,
    value DOUBLE,
    unit TEXT
  );
`;
