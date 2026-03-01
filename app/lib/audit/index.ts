/**
 * Audit Logging Module
 *
 * Comprehensive event tracking and logging system
 *
 * @example
 * ```typescript
 * import { getAuditLogger, auditUserAction, withPerformanceLogging } from '@/lib/audit';
 *
 * // Initialize logger
 * const logger = getAuditLogger();
 * logger.initialize(db);
 *
 * // Log user action
 * auditUserAction('message_sent', 'User sent message', { conversationId: 'abc' });
 *
 * // Wrap function with performance logging
 * const optimizedQuery = withPerformanceLogging(expensiveQuery, 'expensiveQuery');
 * ```
 */

export * from './types';
export { AuditLogger, getAuditLogger } from './logger';
export * from './utils';
