/**
 * Repository Errors
 *
 * Custom error types for repository operations.
 */

/**
 * Base repository error
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/**
 * Entity not found error
 */
export class NotFoundError extends RepositoryError {
  constructor(entityType: string, identifier: string | number) {
    super(
      `${entityType} with identifier '${identifier}' not found`,
      'NOT_FOUND'
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends RepositoryError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Constraint violation error
 */
export class ConstraintError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONSTRAINT_VIOLATION', cause);
    this.name = 'ConstraintError';
  }
}

/**
 * Transaction error
 */
export class TransactionError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'TRANSACTION_ERROR', cause);
    this.name = 'TransactionError';
  }
}

/**
 * Database error
 */
export class DatabaseError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', cause);
    this.name = 'DatabaseError';
  }
}
