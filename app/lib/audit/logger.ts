/**
 * Audit Logger
 *
 * Core audit logging system with:
 * - Event persistence to database
 * - Configurable severity filtering
 * - Performance thresholds
 * - Privacy-preserving logging
 * - Query and analysis capabilities
 *
 * Usage:
 * ```typescript
 * const logger = AuditLogger.getInstance();
 *
 * // Log user action
 * logger.logUserAction('message_sent', 'User sent message', {
 *   conversationId: 'conv-123',
 *   messageLength: 250
 * });
 *
 * // Log error
 * logger.logError('database_error', error, {
 *   component: 'MessageRepository',
 *   action: 'createMessage'
 * });
 *
 * // Log performance metric
 * logger.logPerformance('query_execution', 'SELECT took 150ms', {
 *   duration: 150,
 *   query: 'SELECT * FROM messages'
 * });
 * ```
 */

import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';
import type {
  AuditEvent,
  AnyAuditEvent,
  UserActionEvent,
  UserActionType,
  SystemEvent,
  SystemEventType,
  ErrorEvent,
  ErrorType,
  PerformanceMetricEvent,
  PerformanceMetricType,
  DataOperationEvent,
  EventCategory,
  EventSeverity,
  AuditLogFilter,
  AuditLogQueryResult,
  AuditLoggerConfig,
} from './types';

/**
 * Default Configuration
 */
const DEFAULT_CONFIG: AuditLoggerConfig = {
  enabled: true,
  minSeverity: 'debug',
  persistToDisk: true,
  retentionDays: 90,
  maxFileSizeMB: 100,
  performanceThresholds: {
    queryWarningMs: 100,
    queryCriticalMs: 500,
    memoryWarningMB: 500,
    memoryCriticalMB: 1000,
  },
};

/**
 * Severity Level Rankings (for filtering)
 */
const SEVERITY_RANK: Record<EventSeverity, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};

/**
 * Audit Logger (Singleton)
 */
export class AuditLogger {
  private static instance: AuditLogger | null = null;
  private db: Database.Database | null = null;
  private config: AuditLoggerConfig;
  private sessionId: string;
  private eventBuffer: AnyAuditEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = nanoid();

    // Auto-flush buffer every 5 seconds
    if (this.config.persistToDisk) {
      this.flushInterval = setInterval(() => this.flush(), 5000);
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<AuditLoggerConfig>): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger(config);
    }
    return AuditLogger.instance;
  }

  /**
   * Initialize with database connection
   */
  public initialize(db: Database.Database): void {
    this.db = db;
    this.ensureAuditTable();
  }

  /**
   * Update configuration
   */
  public configure(config: Partial<AuditLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log user action
   */
  public logUserAction(
    type: UserActionType,
    message: string,
    context: UserActionEvent['actionContext'] = {},
    severity: EventSeverity = 'info'
  ): void {
    if (!this.shouldLog('user_action', severity)) return;

    const event: UserActionEvent = {
      id: nanoid(),
      timestamp: Date.now(),
      category: 'user_action',
      severity,
      type,
      message,
      actionContext: context,
      sessionId: this.sessionId,
    };

    this.recordEvent(event);
  }

  /**
   * Log system event
   */
  public logSystemEvent(
    type: SystemEventType,
    message: string,
    context: SystemEvent['systemContext'],
    severity: EventSeverity = 'info'
  ): void {
    if (!this.shouldLog('system_event', severity)) return;

    const event: SystemEvent = {
      id: nanoid(),
      timestamp: Date.now(),
      category: 'system_event',
      severity,
      type,
      message,
      systemContext: context,
      sessionId: this.sessionId,
    };

    this.recordEvent(event);
  }

  /**
   * Log error
   */
  public logError(
    type: ErrorType,
    error: Error,
    context: ErrorEvent['context'],
    severity: EventSeverity = 'error'
  ): void {
    if (!this.shouldLog('error', severity)) return;

    const event: ErrorEvent = {
      id: nanoid(),
      timestamp: Date.now(),
      category: 'error',
      severity,
      type,
      message: error.message,
      error: {
        name: error.name,
        message: error.message,
        ...(error.stack ? { stack: error.stack } : {}),
        ...((error as Error & { code?: string }).code
          ? { code: (error as Error & { code?: string }).code }
          : {}),
      },
      context,
      sessionId: this.sessionId,
    };

    this.recordEvent(event);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[AuditLogger] ${type}:`, error);
    }
  }

  /**
   * Log performance metric
   */
  public logPerformance(
    type: PerformanceMetricType,
    message: string,
    metrics: PerformanceMetricEvent['metrics'],
    metadata?: Record<string, unknown>
  ): void {
    // Determine severity based on thresholds
    const severity = this.determinePerformanceSeverity(type, metrics);

    if (!this.shouldLog('performance', severity)) return;

    const event: PerformanceMetricEvent = {
      id: nanoid(),
      timestamp: Date.now(),
      category: 'performance',
      severity,
      type,
      message,
      metrics,
      ...(this.getPerformanceThresholds(type)
        ? { thresholds: this.getPerformanceThresholds(type) }
        : {}),
      ...(metadata ? { metadata } : {}),
      sessionId: this.sessionId,
    };

    this.recordEvent(event);
  }

  /**
   * Log data operation
   */
  public logDataOperation(
    type: 'create' | 'read' | 'update' | 'delete',
    table: string,
    recordId?: string,
    queryTime?: number
  ): void {
    if (!this.shouldLog('data_operation', 'debug')) return;

    const event: DataOperationEvent = {
      id: nanoid(),
      timestamp: Date.now(),
      category: 'data_operation',
      severity: 'debug',
      type,
      message: `${type.toUpperCase()} operation on ${table}`,
      operation: {
        table,
        ...(recordId ? { recordId } : {}),
        ...(queryTime !== undefined ? { queryTime } : {}),
      },
      sessionId: this.sessionId,
    };

    this.recordEvent(event);
  }

  /**
   * Query audit logs with filtering
   */
  public async query(
    filter: AuditLogFilter = {}
  ): Promise<AuditLogQueryResult> {
    if (!this.db) {
      throw new Error('AuditLogger not initialized with database');
    }

    const {
      category,
      severity,
      startTime,
      endTime,
      sessionId,
      searchTerm,
      limit = 100,
      offset = 0,
    } = filter;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];

    // Category filter
    if (category && category.length > 0) {
      query += ` AND category IN (${category.map(() => '?').join(',')})`;
      params.push(...category);
    }

    // Severity filter
    if (severity && severity.length > 0) {
      query += ` AND severity IN (${severity.map(() => '?').join(',')})`;
      params.push(...severity);
    }

    // Time range filter
    if (startTime) {
      query += ' AND timestamp >= ?';
      params.push(startTime);
    }
    if (endTime) {
      query += ' AND timestamp <= ?';
      params.push(endTime);
    }

    // Session filter
    if (sessionId) {
      query += ' AND session_id = ?';
      params.push(sessionId);
    }

    // Search filter
    if (searchTerm) {
      query += ' AND (message LIKE ? OR metadata LIKE ?)';
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Count total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = this.db.prepare(countQuery).get(...params) as {
      count: number;
    };
    const total = countResult.count;

    // Add pagination
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Execute query
    const rows = this.db.prepare(query).all(...params) as Array<{
      id: string;
      timestamp: number;
      category: string;
      severity: string;
      type: string;
      message: string;
      metadata: string | null;
      session_id: string | null;
    }>;

    // Parse results
    const events = rows.map((row) => this.parseEventRow(row));

    return {
      events,
      total,
      hasMore: offset + events.length < total,
    };
  }

  /**
   * Get statistics about logged events
   */
  public async getStatistics(): Promise<{
    totalEvents: number;
    eventsByCategory: Record<EventCategory, number>;
    eventsBySeverity: Record<EventSeverity, number>;
    recentErrors: number;
  }> {
    if (!this.db) {
      throw new Error('AuditLogger not initialized with database');
    }

    const stats = {
      totalEvents: 0,
      eventsByCategory: {} as Record<EventCategory, number>,
      eventsBySeverity: {} as Record<EventSeverity, number>,
      recentErrors: 0,
    };

    // Total events
    const totalResult = this.db
      .prepare('SELECT COUNT(*) as count FROM audit_logs')
      .get() as { count: number };
    stats.totalEvents = totalResult.count;

    // By category
    const categoryResults = this.db
      .prepare(
        'SELECT category, COUNT(*) as count FROM audit_logs GROUP BY category'
      )
      .all() as { category: EventCategory; count: number }[];
    categoryResults.forEach((row) => {
      stats.eventsByCategory[row.category] = row.count;
    });

    // By severity
    const severityResults = this.db
      .prepare(
        'SELECT severity, COUNT(*) as count FROM audit_logs GROUP BY severity'
      )
      .all() as { severity: EventSeverity; count: number }[];
    severityResults.forEach((row) => {
      stats.eventsBySeverity[row.severity] = row.count;
    });

    // Recent errors (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentErrorsResult = this.db
      .prepare(
        'SELECT COUNT(*) as count FROM audit_logs WHERE category = ? AND timestamp >= ?'
      )
      .get('error', oneDayAgo) as { count: number };
    stats.recentErrors = recentErrorsResult.count;

    return stats;
  }

  /**
   * Clear old audit logs based on retention policy
   */
  public async clearOldLogs(): Promise<number> {
    if (!this.db) {
      throw new Error('AuditLogger not initialized with database');
    }

    const cutoffTime =
      Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;

    const result = this.db
      .prepare('DELETE FROM audit_logs WHERE timestamp < ?')
      .run(cutoffTime);

    return result.changes;
  }

  /**
   * Flush buffered events to database
   */
  public async flush(): Promise<void> {
    if (!this.db || this.eventBuffer.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        id, timestamp, category, severity, type, message, 
        metadata, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((events: AnyAuditEvent[]) => {
      for (const event of events) {
        stmt.run(
          event.id,
          event.timestamp,
          event.category,
          event.severity,
          event.type,
          event.message,
          JSON.stringify(this.sanitizeMetadata(event)),
          event.sessionId || null
        );
      }
    });

    try {
      transaction(this.eventBuffer);
      this.eventBuffer = [];
    } catch (error) {
      console.error('[AuditLogger] Failed to flush events:', error);
    }
  }

  /**
   * Cleanup and shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }

  // Private methods

  private shouldLog(category: EventCategory, severity: EventSeverity): boolean {
    if (!this.config.enabled) return false;
    if (this.config.excludeCategories?.includes(category)) return false;
    if (SEVERITY_RANK[severity] < SEVERITY_RANK[this.config.minSeverity])
      return false;
    return true;
  }

  private recordEvent(event: AnyAuditEvent): void {
    this.eventBuffer.push(event);

    // Immediate flush for critical events
    if (event.severity === 'critical') {
      void this.flush();
    }
  }

  private determinePerformanceSeverity(
    type: PerformanceMetricType,
    metrics: PerformanceMetricEvent['metrics']
  ): EventSeverity {
    const thresholds = this.config.performanceThresholds;
    if (!thresholds) return 'info';

    if (type === 'query_execution' && metrics.duration) {
      if (metrics.duration >= thresholds.queryCriticalMs) return 'critical';
      if (metrics.duration >= thresholds.queryWarningMs) return 'warning';
    }

    if (type === 'memory_usage' && metrics.size) {
      const sizeMB = metrics.size / (1024 * 1024);
      if (sizeMB >= thresholds.memoryCriticalMB) return 'critical';
      if (sizeMB >= thresholds.memoryWarningMB) return 'warning';
    }

    return 'info';
  }

  private getPerformanceThresholds(
    type: PerformanceMetricType
  ): PerformanceMetricEvent['thresholds'] {
    const thresholds = this.config.performanceThresholds;
    if (!thresholds) return undefined;

    if (type === 'query_execution') {
      return {
        warning: thresholds.queryWarningMs,
        critical: thresholds.queryCriticalMs,
      };
    }

    if (type === 'memory_usage') {
      return {
        warning: thresholds.memoryWarningMB,
        critical: thresholds.memoryCriticalMB,
      };
    }

    return undefined;
  }

  private ensureAuditTable(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        session_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);
      CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
      CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_logs(session_id);
    `);
  }

  private sanitizeMetadata(event: AnyAuditEvent): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Include category-specific data
    if (event.category === 'user_action') {
      metadata.actionContext = event.actionContext;
    } else if (event.category === 'system_event') {
      metadata.systemContext = event.systemContext;
    } else if (event.category === 'error') {
      metadata.error = event.error;
      metadata.context = event.context;
    } else if (event.category === 'performance') {
      metadata.metrics = event.metrics;
      metadata.thresholds = event.thresholds;
    } else if (event.category === 'data_operation') {
      metadata.operation = event.operation;
    }

    // Add any additional metadata
    if (event.metadata) {
      Object.assign(metadata, event.metadata);
    }

    return metadata;
  }

  private parseEventRow(row: {
    id: string;
    timestamp: number;
    category: string;
    severity: string;
    type: string;
    message: string;
    metadata: string | null;
    session_id: string | null;
  }): AnyAuditEvent {
    const base: AuditEvent = {
      id: row.id,
      timestamp: row.timestamp,
      category: row.category as EventCategory,
      severity: row.severity as EventSeverity,
      type: row.type,
      message: row.message,
      ...(row.session_id ? { sessionId: row.session_id } : {}),
    };

    const metadata = row.metadata ? JSON.parse(row.metadata) : {};

    // Reconstruct category-specific event
    if (row.category === 'user_action') {
      return {
        ...base,
        category: 'user_action',
        actionContext: metadata.actionContext || {},
      } as UserActionEvent;
    } else if (row.category === 'system_event') {
      return {
        ...base,
        category: 'system_event',
        systemContext: metadata.systemContext || {},
      } as SystemEvent;
    } else if (row.category === 'error') {
      return {
        ...base,
        category: 'error',
        error: metadata.error,
        context: metadata.context,
      } as ErrorEvent;
    } else if (row.category === 'performance') {
      return {
        ...base,
        category: 'performance',
        metrics: metadata.metrics,
        thresholds: metadata.thresholds,
      } as PerformanceMetricEvent;
    } else if (row.category === 'data_operation') {
      return {
        ...base,
        category: 'data_operation',
        operation: metadata.operation,
      } as DataOperationEvent;
    }

    return base as AnyAuditEvent;
  }
}

// Export singleton accessor
export const getAuditLogger = () => AuditLogger.getInstance();
