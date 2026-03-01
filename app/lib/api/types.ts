/**
 * API Types
 *
 * Type definitions for REST API requests and responses
 *
 * @module api/types
 */

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = unknown> {
  /** Whether request succeeded */
  success: boolean;
  /** Response data (if successful) */
  data?: T;
  /** Error message (if failed) */
  error?: string;
  /** Error details for debugging */
  details?: unknown;
  /** Request timestamp */
  timestamp: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total items */
  totalItems: number;
  /** Total pages */
  totalPages: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrevious: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends APIResponse<T> {
  /** Pagination metadata */
  pagination: PaginationMeta;
}

/**
 * Chat request
 */
export interface ChatRequest {
  /** User's message */
  message: string;
  /** Conversation ID (optional - creates new if not provided) */
  conversationId?: string;
  /** System prompt override (optional) */
  systemPrompt?: string;
  /** Temperature override (optional) */
  temperature?: number;
  /** User preferences (optional) */
  preferences?: {
    /** Maximum cost in USD */
    maxCost?: number;
    /** Maximum latency in milliseconds */
    maxLatency?: number;
    /** Preferred AI provider */
    preferredProvider?: string;
  };
  /** Stream response (optional) */
  stream?: boolean;
}

/**
 * Chat response
 */
export interface ChatResponse {
  /** AI response text */
  content: string;
  /** Conversation ID */
  conversationId: string;
  /** Message ID */
  messageId: string;
  /** Strategy used */
  strategy: string;
  /** Models used */
  modelsUsed: string[];
  /** Total cost */
  totalCost: number;
  /** Total latency in milliseconds */
  totalLatencyMs: number;
  /** Ghost approval status */
  ghostApproved: boolean;
  /** Ghost metrics */
  ghostMetrics: {
    preApproval: boolean;
    postApproval: boolean;
    sacredLawsViolated: number;
    rMetric: number;
  };
  /** Metabolism metrics */
  metabolismMetrics: {
    actualCost: number;
    estimatedCost: number;
    costAccuracy: number;
    cognitiveTokensUsed: number;
    budgetRemaining: number;
    budgetStatus: 'ok' | 'warning' | 'exceeded';
  };
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Conversation list item
 */
export interface ConversationListItem {
  /** Conversation ID */
  id: string;
  /** Conversation title */
  title: string;
  /** Last message timestamp */
  lastMessageAt: string;
  /** Message count */
  messageCount: number;
  /** Model used */
  model: string;
  /** Preview text */
  preview: string;
  /** Pinned status */
  pinned: boolean;
  /** Archived status */
  archived: boolean;
}

/**
 * Conversation detail
 */
export interface ConversationDetail extends ConversationListItem {
  /** Messages in conversation */
  messages: ConversationMessage[];
  /** Total token usage */
  totalTokens: number;
  /** Total cost */
  totalCost: number;
  /** Created at */
  createdAt: string;
  /** Updated at */
  updatedAt: string;
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  /** Message ID */
  id: string;
  /** Role */
  role: 'user' | 'assistant';
  /** Content */
  content: string;
  /** Model (for assistant messages) */
  model?: string;
  /** Token usage (for assistant messages) */
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  /** Cost (for assistant messages) */
  cost?: number;
  /** Created at */
  createdAt: string;
}

/**
 * Create conversation request
 */
export interface CreateConversationRequest {
  /** Conversation title */
  title?: string;
  /** Initial message (optional) */
  message?: string;
}

/**
 * Update conversation request
 */
export interface UpdateConversationRequest {
  /** New title */
  title?: string;
  /** Pinned status */
  pinned?: boolean;
  /** Archived status */
  archived?: boolean;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  /** Service status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Uptime in seconds */
  uptime: number;
  /** Engine statuses */
  engines: {
    name: string;
    status: 'ready' | 'initializing' | 'error';
  }[];
  /** Database status */
  database: 'connected' | 'disconnected';
  /** Memory usage in MB */
  memoryUsageMb: number;
  /** Version */
  version: string;
}

/**
 * Rate limit error response
 */
export interface RateLimitError {
  /** Error message */
  message: string;
  /** Retry after (seconds) */
  retryAfter: number;
  /** Limit details */
  limit: {
    /** Requests allowed */
    requests: number;
    /** Window duration in seconds */
    windowMs: number;
  };
}
