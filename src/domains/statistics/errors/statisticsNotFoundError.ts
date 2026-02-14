import type { ErrorDetails } from '../../../types/errors.js';

export class StatisticsNotFoundError extends Error {
  readonly details?: ErrorDetails;

  constructor(message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'StatisticsNotFoundError';
    if (details !== undefined) {
      this.details = details;
    }
  }
}
