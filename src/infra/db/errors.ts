export class RepositoryInfraError extends Error {
  readonly operation: string;
  override readonly cause?: unknown;

  constructor(args: { operation: string; message: string; cause?: unknown }) {
    super(args.message);
    this.name = 'RepositoryInfraError';
    this.operation = args.operation;
    this.cause = args.cause;
  }
}

export class RepositoryQueryTimeoutError extends RepositoryInfraError {
  readonly timeoutMs: number;

  constructor(args: { operation: string; timeoutMs: number; cause?: unknown }) {
    super({
      operation: args.operation,
      message: `Repository operation timed out after ${args.timeoutMs}ms: ${args.operation}`,
      cause: args.cause,
    });
    this.name = 'RepositoryQueryTimeoutError';
    this.timeoutMs = args.timeoutMs;
  }
}
