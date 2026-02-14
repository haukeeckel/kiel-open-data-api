export class CsvFileNotFoundError extends Error {
  readonly csvPath: string;

  constructor(csvPath: string) {
    super(`CSV file not found: ${csvPath}. Run fetch step first.`);
    this.name = 'CsvFileNotFoundError';
    this.csvPath = csvPath;
  }
}
