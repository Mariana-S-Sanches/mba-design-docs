export type ErrorDetails = Record<string, unknown> | unknown[] | undefined;

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details: ErrorDetails;

  constructor(message: string, statusCode: number, errorCode: string, details?: ErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
