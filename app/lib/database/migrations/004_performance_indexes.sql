-- Migration: Add Performance Indexes
-- Created: 2026-01-16
-- Version: 004
--
-- Adds composite indexes to optimize common query patterns

-- =============================================================================
-- COMPOSITE INDEXES FOR CONVERSATIONS
-- =============================================================================

-- Optimize filtered lists (archived = 0 ORDER BY updated_at DESC)
-- This is the most common query pattern
CREATE INDEX IF NOT EXISTS idx_conversations_archived_updated 
  ON conversations(archived, updated_at DESC);

-- Optimize model tier filtering with sorting
-- Used when filtering by model tier (haiku/sonnet/opus)
CREATE INDEX IF NOT EXISTS idx_conversations_tier_updated 
  ON conversations(model_tier, updated_at DESC);

-- Optimize date range queries with archival filtering
-- Used in analytics and date-based searches
CREATE INDEX IF NOT EXISTS idx_conversations_created_archived 
  ON conversations(created_at DESC, archived);

-- Optimize cost-based queries and sorting
-- Used for billing analytics and cost tracking
CREATE INDEX IF NOT EXISTS idx_conversations_cost 
  ON conversations(total_cost DESC);

-- =============================================================================
-- COMPOSITE INDEXES FOR MESSAGES
-- =============================================================================

-- Optimize message queries with role filtering
-- Used when fetching user vs assistant messages separately
CREATE INDEX IF NOT EXISTS idx_messages_conversation_role 
  ON messages(conversation_id, role, created_at);

-- =============================================================================
-- QUERY PLANNER STATISTICS
-- =============================================================================

-- Update query planner statistics for better optimization
ANALYZE conversations;
ANALYZE messages;
ANALYZE attachments;
ANALYZE conversations_fts;
ANALYZE messages_fts;
