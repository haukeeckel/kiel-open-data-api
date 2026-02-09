export class StatisticsValidationError extends Error {
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'StatisticsValidationError';
    this.details = details;
  }
}
