/**
 * Audit Logging Types
 *
 * Defines event types, schema, and interfaces for comprehensive system auditing
 *
 * Features:
 * - Event tracking (user actions, system events)
 * - Error logging (categorized, with context)
 * - Performance metrics (query times, resource usage)
 * - Privacy-preserving (no PII in logs)
 */

import type { UUID, Timestamp } from '../types/domain';

/**
 * Event Categories
 */
export type EventCategory =
  | 'user_action' // User-initiated actions
  | 'system_event' // System-generated events
  | 'error' // Errors and exceptions
  | 'performance' // Performance metrics
  | 'security' // Security-related events
  | 'data_operation'; // Database operations

/**
 * Event Severity Levels
 */
export type EventSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

/**
 * User Action Types
 */
export type UserActionType =
  | 'conversation_created'
  | 'conversation_deleted'
  | 'conversation_archived'
  | 'message_sent'
  | 'message_deleted'
  | 'attachment_uploaded'
  | 'settings_changed'
  | 'theme_toggled'
  | 'model_selected'
  | 'search_performed'
  | 'export_initiated';

/**
 * System Event Types
 */
export type SystemEventType =
  | 'app_started'
  | 'app_stopped'
  | 'database_connected'
  | 'database_disconnected'
  | 'migration_run'
  | 'cache_cleared'
  | 'background_job_started'
  | 'background_job_completed'
  | 'ai_request_started'
  | 'ai_request_completed';

/**
 * Error Types
 */
export type ErrorType =
  | 'database_error'
  | 'network_error'
  | 'ai_provider_error'
  | 'validation_error'
  | 'auth_error'
  | 'rate_limit_error'
  | 'unknown_error';

/**
 * Performance Metric Types
 */
export type PerformanceMetricType =
  | 'query_execution'
  | 'api_response_time'
  | 'render_time'
  | 'memory_usage'
  | 'cpu_usage'
  | 'disk_io'
  | 'network_latency';

/**
 * Base Audit Event
 */
export interface AuditEvent {
  id: UUID;
  timestamp: Timestamp;
  category: EventCategory;
  severity: EventSeverity;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  userId?: string; // Future: when user accounts exist
}

/**
 * User Action Event
 */
export interface UserActionEvent extends AuditEvent {
  category: 'user_action';
  type: UserActionType;
  actionContext: {
    component?: string;
    conversationId?: UUID;
    messageId?: UUID;
    previousValue?: unknown;
    newValue?: unknown;
  };
}

/**
 * System Event
 */
export interface SystemEvent extends AuditEvent {
  category: 'system_event';
  type: SystemEventType;
  systemContext: {
    component: string;
    version?: string;
    environment?: string;
  };
}

/**
 * Error Event
 */
export interface ErrorEvent extends AuditEvent {
  category: 'error';
  type: ErrorType;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context: {
    component: string;
    action: string;
    input?: unknown;
    state?: unknown;
  };
}

/**
 * Performance Metric Event
 */
export interface PerformanceMetricEvent extends AuditEvent {
  category: 'performance';
  type: PerformanceMetricType;
  metrics: {
    duration?: number; // milliseconds
    size?: number; // bytes
    count?: number;
    throughput?: number;
    utilization?: number; // percentage
  };
  thresholds?:
    | {
        warning?: number;
        critical?: number;
      }
    | undefined;
}

/**
 * Data Operation Event
 */
export interface DataOperationEvent extends AuditEvent {
  category: 'data_operation';
  type: 'create' | 'read' | 'update' | 'delete';
  operation: {
    table: string;
    recordId?: UUID;
    recordCount?: number;
    queryTime?: number;
  };
}

/**
 * Audit Event Union Type
 */
export type AnyAuditEvent =
  | UserActionEvent
  | SystemEvent
  | ErrorEvent
  | PerformanceMetricEvent
  | DataOperationEvent;

/**
 * Audit Log Filter
 */
export interface AuditLogFilter {
  category?: EventCategory[];
  severity?: EventSeverity[];
  startTime?: Timestamp;
  endTime?: Timestamp;
  sessionId?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

/**
 * Audit Log Query Result
 */
export interface AuditLogQueryResult {
  events: AnyAuditEvent[];
  total: number;
  hasMore: boolean;
}

/**
 * Audit Logger Configuration
 */
export interface AuditLoggerConfig {
  enabled: boolean;
  minSeverity: EventSeverity;
  persistToDisk: boolean;
  retentionDays: number;
  maxFileSizeMB: number;
  excludeCategories?: EventCategory[];
  performanceThresholds?: {
    queryWarningMs: number;
    queryCriticalMs: number;
    memoryWarningMB: number;
    memoryCriticalMB: number;
  };
}
