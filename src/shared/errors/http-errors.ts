import { AppError, type ErrorDetails } from './app-error.js';

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details?: ErrorDetails) {
    super(message, 400, code, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: ErrorDetails) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT', details?: ErrorDetails) {
    super(message, 409, code, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, code = 'UNPROCESSABLE_ENTITY', details?: ErrorDetails) {
    super(message, 422, code, details);
  }
}

export class InvalidStatusTransitionError extends ConflictError {
  constructor(from: string, to: string) {
    super(
      `Invalid status transition from ${from} to ${to}`,
      'INVALID_STATUS_TRANSITION',
      { from, to },
    );
  }
}

export class InsufficientStockError extends UnprocessableEntityError {
  constructor(unavailable: { sku: string; requested: number; available: number }[]) {
    super(
      'One or more products do not have enough stock',
      'INSUFFICIENT_STOCK',
      { unavailable },
    );
  }
}
