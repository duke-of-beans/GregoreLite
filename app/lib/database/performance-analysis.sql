-- Performance Analysis for GREGORE Database
-- Run these queries to identify optimization opportunities

-- =============================================================================
-- QUERY PLAN ANALYSIS
-- =============================================================================

-- Analyze conversation list query (most common operation)
EXPLAIN QUERY PLAN
SELECT * FROM conversations_with_stats 
WHERE archived = 0
ORDER BY updated_at DESC
LIMIT 20 OFFSET 0;

-- Analyze conversation search with filters
EXPLAIN QUERY PLAN
SELECT * FROM conversations_with_stats 
WHERE model_tier = 'sonnet'
  AND archived = 0
  AND created_at >= 1704067200
ORDER BY updated_at DESC
LIMIT 20;

-- Analyze FTS search
EXPLAIN QUERY PLAN
SELECT * FROM conversations_with_stats
WHERE id IN (SELECT id FROM conversations_fts WHERE title MATCH 'test')
ORDER BY updated_at DESC;

-- Analyze message query with conversation
EXPLAIN QUERY PLAN
SELECT * FROM messages 
WHERE conversation_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at ASC;

-- Analyze message FTS search
EXPLAIN QUERY PLAN
SELECT m.* FROM messages m
WHERE m.id IN (SELECT id FROM messages_fts WHERE content MATCH 'query')
ORDER BY m.created_at DESC;

-- Analyze conversation statistics query
EXPLAIN QUERY PLAN
SELECT 
  COUNT(*) as total_conversations,
  COALESCE(SUM(message_count), 0) as total_messages,
  COALESCE(SUM(total_tokens), 0) as total_tokens,
  COALESCE(SUM(total_cost), 0) as total_cost
FROM conversations_with_stats;

-- =============================================================================
-- MISSING INDEX OPPORTUNITIES
-- =============================================================================

-- Check queries that might benefit from composite indexes

-- 1. Filtered lists (archived + updated_at for sorting)
-- Current: Uses idx_conversations_archived (partial) OR idx_conversations_updated_at
-- Opportunity: Composite index for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_archived_updated 
  ON conversations(archived, updated_at DESC);

-- 2. Model tier filtering with sorting
-- Current: Uses idx_conversations_model_tier then sorts
-- Opportunity: Composite index for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_tier_updated 
  ON conversations(model_tier, updated_at DESC);

-- 3. Date range queries with filtering
-- Current: Full table scan for date ranges
-- Opportunity: Composite indexes for common patterns
CREATE INDEX IF NOT EXISTS idx_conversations_created_archived 
  ON conversations(created_at DESC, archived);

-- 4. Cost-based queries
-- Current: No index on total_cost
-- Opportunity: Add index for cost-based filtering/sorting
CREATE INDEX IF NOT EXISTS idx_conversations_cost 
  ON conversations(total_cost DESC);

-- 5. Message lookup with role filtering
-- Current: Uses idx_messages_conversation_id then filters role
-- Opportunity: Composite index for conversation + role queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_role 
  ON messages(conversation_id, role, created_at);

-- =============================================================================
-- STATISTICS COLLECTION
-- =============================================================================

-- Analyze tables to update SQLite statistics
-- This helps the query planner make better decisions
ANALYZE conversations;
ANALYZE messages;
ANALYZE attachments;
ANALYZE conversations_fts;
ANALYZE messages_fts;

-- =============================================================================
-- PERFORMANCE METRICS
-- =============================================================================

-- Count total rows per table
SELECT 'conversations' as table_name, COUNT(*) as row_count FROM conversations
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'attachments', COUNT(*) FROM attachments;

-- Average rows per conversation
SELECT 
  AVG(message_count) as avg_messages_per_conversation,
  MAX(message_count) as max_messages_per_conversation,
  MIN(message_count) as min_messages_per_conversation
FROM conversations_with_stats;

-- Identify large conversations (potential performance bottlenecks)
SELECT 
  id,
  title,
  message_count,
  total_tokens,
  total_cost
FROM conversations_with_stats
WHERE message_count > 100
ORDER BY message_count DESC
LIMIT 10;

-- Index usage statistics (requires STAT4 compile option)
-- Note: May not work in all SQLite builds
SELECT * FROM sqlite_stat1 WHERE tbl = 'conversations';
SELECT * FROM sqlite_stat1 WHERE tbl = 'messages';

-- =============================================================================
-- OPTIMIZATION RECOMMENDATIONS
-- =============================================================================

-- 1. COMPOSITE INDEXES ADDED:
--    - conversations(archived, updated_at DESC) for filtered lists
--    - conversations(model_tier, updated_at DESC) for tier filtering
--    - conversations(created_at DESC, archived) for date ranges
--    - conversations(total_cost DESC) for cost queries
--    - messages(conversation_id, role, created_at) for role filtering

-- 2. QUERY OPTIMIZATIONS NEEDED:
--    - Use prepared statements (already done in repositories)
--    - Limit result sets with pagination (already done)
--    - Use covering indexes where possible

-- 3. SCHEMA OPTIMIZATIONS:
--    - Consider INTEGER PRIMARY KEY for auto-increment (not needed for UUIDs)
--    - VACUUM periodically to reclaim space and optimize layout
--    - Set appropriate page_size (default 4096 is usually good)

-- 4. MEMORY/CACHE SETTINGS:
PRAGMA cache_size = 10000;        -- 10000 pages * 4KB = ~40MB cache
PRAGMA temp_store = MEMORY;       -- Store temp tables in memory
PRAGMA mmap_size = 268435456;     -- 256MB memory-mapped I/O
PRAGMA journal_mode = WAL;        -- Write-Ahead Logging for concurrency

-- 5. ANALYZE REGULARLY:
--    Run ANALYZE after bulk inserts or significant data changes
--    This keeps query planner statistics up to date
