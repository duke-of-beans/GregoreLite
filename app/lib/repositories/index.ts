/**
 * Repositories Module
 *
 * Data access layer for GREGORE.
 * Production-ready repositories with full features.
 */

// Base classes and types
export { BaseRepository } from './base-repository';
export type {
  Result,
  PaginationParams,
  PaginatedResult,
  SortOrder,
  FilterOperator,
  Filter,
  TransactionContext,
} from './types';

export {
  RepositoryError,
  NotFoundError,
  ValidationError,
  ConstraintError,
  TransactionError,
  DatabaseError,
} from './errors';

// Conversation repository
export {
  ConversationRepository,
  type Conversation,
  type ConversationWithStats,
  type ConversationSearchParams,
  type ConversationListParams,
  type ConversationStats,
} from './conversation-repository';

// Message repository
export {
  MessageRepository,
  type Message,
  type MessageWithAttachments,
  type CreateMessageData,
  type MessageSearchParams,
  type MessageListParams,
  type TokenStats,
  type MessageChunk,
} from './message-repository';

// Attachment repository
export {
  AttachmentRepository,
  type Attachment,
  type CreateAttachmentData,
  type AttachmentMetadata,
  type AttachmentStats,
} from './attachment-repository';
