/**
 * Repository Types
 *
 * Common types used across all repositories.
 */

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page: number;
  /** Items per page */
  pageSize: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Sort order
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Filter operator
 */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'like'
  | 'between';

/**
 * Generic filter
 */
export interface Filter<T> {
  field: keyof T;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Transaction context for repository operations
 */
export interface TransactionContext {
  /** Unique transaction ID */
  id: string;
  /** Transaction start time */
  startedAt: Date;
  /** Whether transaction is active */
  isActive: boolean;
}
