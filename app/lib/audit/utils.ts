/**
 * Audit Logging Utilities
 *
 * Convenience functions and decorators for common logging patterns
 */

import { getAuditLogger } from './logger';
import type { UserActionType, SystemEventType, ErrorType } from './types';

/**
 * Function wrapper that logs execution time
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withPerformanceLogging<T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  warningThresholdMs = 100
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const startTime = performance.now();
    const result = fn(...args);

    // Handle async functions
    if (result instanceof Promise) {
      return result.then((value) => {
        const duration = performance.now() - startTime;
        logFunctionPerformance(name, duration, warningThresholdMs);
        return value;
      }) as ReturnType<T>;
    }

    // Sync function
    const duration = performance.now() - startTime;
    logFunctionPerformance(name, duration, warningThresholdMs);
    return result;
  }) as T;
}

/**
 * Log function performance
 */
function logFunctionPerformance(
  name: string,
  duration: number,
  threshold: number
): void {
  const logger = getAuditLogger();
  logger.logPerformance(
    'query_execution',
    `Function ${name} executed in ${duration.toFixed(2)}ms`,
    { duration },
    { functionName: name, threshold }
  );
}

/**
 * Error boundary wrapper with automatic error logging
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorLogging<T extends (...args: any[]) => any>(
  fn: T,
  component: string,
  action: string
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error) => {
          logErrorWithContext(error, component, action, { args });
          throw error;
        }) as ReturnType<T>;
      }

      return result;
    } catch (error) {
      logErrorWithContext(error, component, action, { args });
      throw error;
    }
  }) as T;
}

/**
 * Log error with context
 */
function logErrorWithContext(
  error: unknown,
  component: string,
  action: string,
  metadata: Record<string, unknown>
): void {
  const logger = getAuditLogger();
  const err = error instanceof Error ? error : new Error(String(error));

  logger.logError(
    'unknown_error',
    err,
    {
      component,
      action,
      input: metadata.args,
    },
    'error'
  );
}

/**
 * Quick user action logging helpers
 */
export const auditUserAction = (
  type: UserActionType,
  message: string,
  context?: Record<string, unknown>
) => {
  getAuditLogger().logUserAction(type, message, context);
};

export const auditConversationCreated = (conversationId: string) => {
  auditUserAction('conversation_created', 'User created new conversation', {
    conversationId,
  });
};

export const auditConversationDeleted = (conversationId: string) => {
  auditUserAction('conversation_deleted', 'User deleted conversation', {
    conversationId,
  });
};

export const auditMessageSent = (
  conversationId: string,
  messageLength: number
) => {
  auditUserAction('message_sent', 'User sent message', {
    conversationId,
    messageLength,
  });
};

export const auditSettingsChanged = (
  setting: string,
  oldValue: unknown,
  newValue: unknown
) => {
  auditUserAction('settings_changed', `User changed ${setting}`, {
    actionContext: {
      previousValue: oldValue,
      newValue,
    },
  });
};

/**
 * Quick system event logging helpers
 */
export const auditSystemEvent = (
  type: SystemEventType,
  message: string,
  component: string
) => {
  getAuditLogger().logSystemEvent(type, message, { component });
};

export const auditAppStarted = () => {
  auditSystemEvent('app_started', 'Application started', 'App');
};

export const auditDatabaseConnected = () => {
  auditSystemEvent(
    'database_connected',
    'Database connection established',
    'Database'
  );
};

export const auditMigrationRun = (version: string) => {
  auditSystemEvent(
    'migration_run',
    `Migration ${version} executed`,
    'Database'
  );
};

/**
 * Quick error logging helpers
 */
export const auditError = (
  type: ErrorType,
  error: Error,
  component: string,
  action: string
) => {
  getAuditLogger().logError(type, error, { component, action });
};

export const auditDatabaseError = (error: Error, action: string) => {
  auditError('database_error', error, 'Database', action);
};

export const auditNetworkError = (error: Error, action: string) => {
  auditError('network_error', error, 'Network', action);
};

export const auditAIProviderError = (
  error: Error,
  provider: string,
  action: string
) => {
  auditError('ai_provider_error', error, provider, action);
};

/**
 * Query performance tracker
 */
export class QueryPerformanceTracker {
  private startTime: number;
  private queryName: string;

  constructor(queryName: string) {
    this.queryName = queryName;
    this.startTime = performance.now();
  }

  /**
   * Complete the query and log performance
   */
  public complete(metadata?: Record<string, unknown>): void {
    const duration = performance.now() - this.startTime;
    const logger = getAuditLogger();

    logger.logPerformance(
      'query_execution',
      `Query ${this.queryName} completed in ${duration.toFixed(2)}ms`,
      { duration },
      { queryName: this.queryName, ...metadata }
    );
  }
}

/**
 * Memory usage tracker
 */
export function logMemoryUsage(label: string): void {
  if (
    typeof performance === 'undefined' ||
    !(performance as unknown as { memory?: unknown }).memory
  ) {
    return; // Memory API not available
  }

  const memory = (
    performance as unknown as {
      memory: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    }
  ).memory;
  const usedMB = memory.usedJSHeapSize / (1024 * 1024);
  const totalMB = memory.totalJSHeapSize / (1024 * 1024);
  const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);

  const logger = getAuditLogger();
  logger.logPerformance(
    'memory_usage',
    `Memory usage at ${label}: ${usedMB.toFixed(2)}MB / ${totalMB.toFixed(2)}MB (limit: ${limitMB.toFixed(2)}MB)`,
    {
      size: memory.usedJSHeapSize,
      utilization: (usedMB / limitMB) * 100,
    },
    {
      label,
      total: totalMB,
      limit: limitMB,
    }
  );
}

/**
 * Data operation logger
 */
export function logDataOperation(
  type: 'create' | 'read' | 'update' | 'delete',
  table: string,
  recordId?: string,
  startTime?: number
): void {
  const queryTime = startTime ? performance.now() - startTime : undefined;
  getAuditLogger().logDataOperation(type, table, recordId, queryTime);
}

/**
 * Batch operation tracker
 */
export class BatchOperationTracker {
  private startTime: number;
  private operationType: string;
  private itemCount = 0;

  constructor(operationType: string) {
    this.operationType = operationType;
    this.startTime = performance.now();
  }

  /**
   * Increment item count
   */
  public incrementCount(): void {
    this.itemCount++;
  }

  /**
   * Complete batch and log metrics
   */
  public complete(): void {
    const duration = performance.now() - this.startTime;
    const throughput = this.itemCount / (duration / 1000); // items per second

    const logger = getAuditLogger();
    logger.logPerformance(
      'query_execution',
      `Batch ${this.operationType} completed: ${this.itemCount} items in ${duration.toFixed(2)}ms`,
      {
        duration,
        count: this.itemCount,
        throughput,
      },
      {
        operationType: this.operationType,
      }
    );
  }
}
