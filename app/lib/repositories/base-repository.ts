/**
 * Base Repository
 *
 * Abstract base class providing common CRUD operations and utilities.
 * All repositories should extend this class.
 */

import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import {
  DatabaseError,
  NotFoundError,
  ConstraintError,
  ValidationError,
} from './errors';
import { Result, PaginationParams, PaginatedResult, SortOrder } from './types';
import { QueryTracker } from '../utils/performance';

/**
 * Base repository with common operations
 */
export abstract class BaseRepository<T extends { id: string }> {
  protected db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Table name for this repository
   */
  protected abstract get tableName(): string;

  /**
   * Convert database row to domain entity
   */
  protected abstract rowToEntity(row: unknown): T;

  /**
   * Convert domain entity to database row
   */
  protected abstract entityToRow(entity: Partial<T>): Record<string, unknown>;

  /**
   * Execute query with performance tracking
   */
  protected executeQuery<R>(query: string, ...params: unknown[]): R {
    const startTime = performance.now();
    try {
      const result = this.db.prepare(query).get(...params) as R;
      const duration = performance.now() - startTime;
      QueryTracker.track(query, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      QueryTracker.track(query, duration);
      throw error;
    }
  }

  /**
   * Execute query returning all rows with performance tracking
   */
  protected executeQueryAll<R>(query: string, ...params: unknown[]): R[] {
    const startTime = performance.now();
    try {
      const result = this.db.prepare(query).all(...params) as R[];
      const duration = performance.now() - startTime;
      QueryTracker.track(query, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      QueryTracker.track(query, duration);
      throw error;
    }
  }

  /**
   * Execute statement with performance tracking
   */
  protected executeStatement(
    query: string,
    ...params: unknown[]
  ): Database.RunResult {
    const startTime = performance.now();
    try {
      const result = this.db.prepare(query).run(...params);
      const duration = performance.now() - startTime;
      QueryTracker.track(query, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      QueryTracker.track(query, duration);
      throw error;
    }
  }

  /**
   * Find entity by ID
   */
  findById(id: string): Result<T> {
    try {
      const row = this.db
        .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
        .get(id);

      if (!row) {
        return {
          ok: false,
          error: new NotFoundError(this.tableName, id),
        };
      }

      return {
        ok: true,
        value: this.rowToEntity(row),
      };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          `Failed to find ${this.tableName} by ID`,
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Find all entities
   */
  findAll(): Result<T[]> {
    try {
      const rows = this.db.prepare(`SELECT * FROM ${this.tableName}`).all();

      return {
        ok: true,
        value: rows.map((row) => this.rowToEntity(row)),
      };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          `Failed to find all ${this.tableName}`,
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Find entities with pagination
   */
  findPaginated(
    params: PaginationParams,
    orderBy: string = 'created_at',
    order: SortOrder = 'desc'
  ): Result<PaginatedResult<T>> {
    try {
      const { page, pageSize } = params;
      const offset = (page - 1) * pageSize;

      // Get total count
      const countResult = this.db
        .prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`)
        .get() as { count: number };

      const total = countResult.count;
      const totalPages = Math.ceil(total / pageSize);

      // Get page data
      const rows = this.db
        .prepare(
          `SELECT * FROM ${this.tableName} 
           ORDER BY ${orderBy} ${order.toUpperCase()}
           LIMIT ? OFFSET ?`
        )
        .all(pageSize, offset);

      const items = rows.map((row) => this.rowToEntity(row));

      return {
        ok: true,
        value: {
          items,
          total,
          page,
          pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          `Failed to paginate ${this.tableName}`,
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Create new entity
   */
  create(entity: Partial<T>): Result<T> {
    try {
      const row = this.entityToRow(entity);
      const columns = Object.keys(row);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(row);

      const stmt = this.db.prepare(
        `INSERT INTO ${this.tableName} (${columns.join(', ')}) 
         VALUES (${placeholders})`
      );

      stmt.run(...values);

      // Fetch created entity
      return this.findById(entity.id!);
    } catch (error) {
      // Check for constraint violations
      if (
        error instanceof Error &&
        (error.message.includes('UNIQUE') ||
          error.message.includes('FOREIGN KEY') ||
          error.message.includes('CHECK'))
      ) {
        return {
          ok: false,
          error: new ConstraintError(
            `Constraint violation creating ${this.tableName}`,
            error
          ),
        };
      }

      return {
        ok: false,
        error: new DatabaseError(
          `Failed to create ${this.tableName}`,
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Update entity
   */
  update(id: string, updates: Partial<T>): Result<T> {
    try {
      const row = this.entityToRow(updates);
      const columns = Object.keys(row);
      const setClause = columns.map((col) => `${col} = ?`).join(', ');
      const values = [...Object.values(row), id];

      const stmt = this.db.prepare(
        `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`
      );

      const result = stmt.run(...values);

      if (result.changes === 0) {
        return {
          ok: false,
          error: new NotFoundError(this.tableName, id),
        };
      }

      // Fetch updated entity
      return this.findById(id);
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          `Failed to update ${this.tableName}`,
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Delete entity
   */
  delete(id: string): Result<void> {
    try {
      const stmt = this.db.prepare(
        `DELETE FROM ${this.tableName} WHERE id = ?`
      );
      const result = stmt.run(id);

      if (result.changes === 0) {
        return {
          ok: false,
          error: new NotFoundError(this.tableName, id),
        };
      }

      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          `Failed to delete ${this.tableName}`,
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Check if entity exists
   */
  exists(id: string): boolean {
    const result = this.db
      .prepare(`SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`)
      .get(id);

    return result !== undefined;
  }

  /**
   * Count all entities
   */
  count(): number {
    const result = this.db
      .prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`)
      .get() as { count: number };

    return result.count;
  }

  /**
   * Execute in transaction
   */
  protected transaction<R>(callback: () => R): Result<R> {
    try {
      const fn = this.db.transaction(callback);
      const result = fn();
      return { ok: true, value: result };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Transaction failed',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Validate entity before save
   * Override in subclasses for custom validation
   */
  protected validate(entity: Partial<T>): Result<void> {
    // Basic validation - entity must have ID for updates
    if (!entity.id && this.constructor.name !== 'create') {
      return {
        ok: false,
        error: new ValidationError('Entity ID is required'),
      };
    }

    return { ok: true, value: undefined };
  }
}
