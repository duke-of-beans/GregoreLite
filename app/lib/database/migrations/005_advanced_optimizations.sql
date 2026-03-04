-- Migration 005: Advanced Optimizations
-- Covering indexes and filtered indexes for common query patterns

-- Covering index for conversation list query (avoids table lookup)
CREATE INDEX IF NOT EXISTS idx_conversations_list_covering
  ON conversations(updated_at DESC, id, title, model, is_archived, is_pinned, total_cost);

-- Covering index for pinned conversations
CREATE INDEX IF NOT EXISTS idx_conversations_pinned_covering
  ON conversations(is_pinned, updated_at DESC, id, title)
  WHERE is_pinned = 1;

-- Filtered index: active (non-archived) conversations only
CREATE INDEX IF NOT EXISTS idx_conversations_active_only
  ON conversations(updated_at DESC)
  WHERE is_archived = 0;

-- Filtered index: archived conversations only
CREATE INDEX IF NOT EXISTS idx_conversations_archived_only
  ON conversations(updated_at DESC)
  WHERE is_archived = 1;

-- Filtered index: expensive conversations (cost > 0)
CREATE INDEX IF NOT EXISTS idx_conversations_expensive
  ON conversations(total_cost DESC)
  WHERE total_cost > 0;

-- Message pagination index
CREATE INDEX IF NOT EXISTS idx_messages_pagination
  ON messages(conversation_id, created_at DESC, id);

-- Message token tracking
CREATE INDEX IF NOT EXISTS idx_messages_tokens
  ON messages(conversation_id, prompt_tokens, completion_tokens)
  WHERE prompt_tokens > 0 OR completion_tokens > 0;

-- Large attachments (redefine with better threshold)
CREATE INDEX IF NOT EXISTS idx_attachments_large_files
  ON attachments(size DESC)
  WHERE size > 1048576;
