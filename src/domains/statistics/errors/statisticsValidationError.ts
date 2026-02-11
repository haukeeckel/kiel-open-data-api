import type { ErrorDetails } from '../../../app/http/errors.js';

export class StatisticsValidationError extends Error {
  readonly details?: ErrorDetails;

  constructor(message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'StatisticsValidationError';
    if (details !== undefined) {
      this.details = details;
    }
  }
}
