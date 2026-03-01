/**
 * API Module Index
 *
 * @module api
 */

// Types
export type {
  APIResponse,
  PaginationMeta,
  PaginatedResponse,
  ChatRequest,
  ChatResponse,
  ConversationListItem,
  ConversationDetail,
  ConversationMessage,
  CreateConversationRequest,
  UpdateConversationRequest,
  HealthCheckResponse,
  RateLimitError,
} from './types';

// Utilities
export {
  successResponse,
  errorResponse,
  validationError,
  rateLimitError,
  validateRequired,
  parseRequestBody,
  safeHandler,
  getSearchParams,
  parsePaginationParams,
} from './utils';

// Rate limiting
export { rateLimiter, getRateLimitIdentifier } from './rate-limiter';
