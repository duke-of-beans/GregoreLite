-- Migration 002: Additional Performance Indexes
-- Created: January 15, 2026
-- Description: Add covering indexes and composite indexes for common query patterns

-- =============================================================================
-- COVERING INDEXES FOR CONVERSATIONS
-- =============================================================================

-- Cover common list queries (archived conversations with stats)
CREATE INDEX IF NOT EXISTS idx_conversations_list_archived 
  ON conversations(archived, updated_at DESC, pinned)
  WHERE archived = 0;

-- Cover pinned conversations query
CREATE INDEX IF NOT EXISTS idx_conversations_list_pinned 
  ON conversations(pinned, updated_at DESC)
  WHERE pinned = 1;

-- Cover model tier analytics queries
CREATE INDEX IF NOT EXISTS idx_conversations_model_analytics 
  ON conversations(model_tier, created_at, total_tokens, total_cost);

-- Cover cost tracking queries
CREATE INDEX IF NOT EXISTS idx_conversations_cost_tracking 
  ON conversations(created_at, total_cost, total_tokens)
  WHERE archived = 0;

-- =============================================================================
-- COVERING INDEXES FOR MESSAGES
-- =============================================================================

-- Cover message list with role filtering
CREATE INDEX IF NOT EXISTS idx_messages_conversation_role_time 
  ON messages(conversation_id, role, created_at DESC);

-- Cover token analytics queries
CREATE INDEX IF NOT EXISTS idx_messages_token_analytics 
  ON messages(conversation_id, input_tokens, output_tokens, cost)
  WHERE input_tokens IS NOT NULL;

-- Cover model usage tracking
CREATE INDEX IF NOT EXISTS idx_messages_model_usage 
  ON messages(model, created_at)
  WHERE model IS NOT NULL;

-- Cover assistant message queries (for streaming/display)
CREATE INDEX IF NOT EXISTS idx_messages_assistant 
  ON messages(conversation_id, created_at)
  WHERE role = 'assistant';

-- =============================================================================
-- COVERING INDEXES FOR ATTACHMENTS
-- =============================================================================

-- Cover attachment list by type
CREATE INDEX IF NOT EXISTS idx_attachments_type_message 
  ON attachments(type, message_id, created_at);

-- Cover large attachment queries
CREATE INDEX IF NOT EXISTS idx_attachments_large_files 
  ON attachments(size DESC, type)
  WHERE size > 1048576; -- 1MB

-- Cover MIME type filtering
CREATE INDEX IF NOT EXISTS idx_attachments_mime_type 
  ON attachments(mime_type, message_id);

-- =============================================================================
-- COMPOSITE INDEXES FOR COMMON JOIN PATTERNS
-- =============================================================================

-- Optimize conversation → messages join
CREATE INDEX IF NOT EXISTS idx_messages_conv_created 
  ON messages(conversation_id, created_at ASC);

-- Optimize messages → attachments join
CREATE INDEX IF NOT EXISTS idx_attachments_msg_created 
  ON attachments(message_id, created_at ASC);

-- =============================================================================
-- ANALYSIS INDEXES
-- =============================================================================

-- Support ANALYZE for query planner
ANALYZE conversations;
ANALYZE messages;
ANALYZE attachments;
