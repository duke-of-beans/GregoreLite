-- GREGORE Database Schema
-- Version: 1.0.0
-- Created: January 15, 2026
--
-- Core tables for conversation management, message storage, and attachments

-- =============================================================================
-- CONVERSATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  model TEXT NOT NULL,
  model_tier TEXT NOT NULL CHECK(model_tier IN ('haiku', 'sonnet', 'opus')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0, 1)),
  total_tokens INTEGER NOT NULL DEFAULT 0 CHECK(total_tokens >= 0),
  total_cost REAL NOT NULL DEFAULT 0.0 CHECK(total_cost >= 0.0)
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_created_at 
  ON conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at 
  ON conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_archived 
  ON conversations(archived) 
  WHERE archived = 0;

CREATE INDEX IF NOT EXISTS idx_conversations_pinned 
  ON conversations(pinned) 
  WHERE pinned = 1;

CREATE INDEX IF NOT EXISTS idx_conversations_model_tier 
  ON conversations(model_tier);

-- Full-text search for conversations
CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
  id UNINDEXED,
  title,
  content='conversations',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS conversations_fts_insert 
  AFTER INSERT ON conversations
BEGIN
  INSERT INTO conversations_fts(rowid, id, title)
  VALUES (NEW.rowid, NEW.id, NEW.title);
END;

CREATE TRIGGER IF NOT EXISTS conversations_fts_update 
  AFTER UPDATE ON conversations
BEGIN
  UPDATE conversations_fts 
  SET title = NEW.title
  WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER IF NOT EXISTS conversations_fts_delete 
  AFTER DELETE ON conversations
BEGIN
  DELETE FROM conversations_fts WHERE rowid = OLD.rowid;
END;

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS conversations_update_timestamp
  AFTER UPDATE ON conversations
BEGIN
  UPDATE conversations 
  SET updated_at = unixepoch()
  WHERE id = NEW.id;
END;

-- =============================================================================
-- MESSAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER CHECK(input_tokens >= 0),
  output_tokens INTEGER CHECK(output_tokens >= 0),
  cost REAL CHECK(cost >= 0.0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) 
    ON DELETE CASCADE
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
  ON messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at 
  ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_role 
  ON messages(conversation_id, role);

-- Full-text search for messages
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  id UNINDEXED,
  content,
  content='messages',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS messages_fts_insert 
  AFTER INSERT ON messages
BEGIN
  INSERT INTO messages_fts(rowid, id, content)
  VALUES (NEW.rowid, NEW.id, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update 
  AFTER UPDATE ON messages
BEGIN
  UPDATE messages_fts 
  SET content = NEW.content
  WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_delete 
  AFTER DELETE ON messages
BEGIN
  DELETE FROM messages_fts WHERE rowid = OLD.rowid;
END;

-- Trigger to update conversation stats on message insert
CREATE TRIGGER IF NOT EXISTS messages_update_conversation_stats
  AFTER INSERT ON messages
BEGIN
  UPDATE conversations
  SET 
    total_tokens = total_tokens + 
      COALESCE(NEW.input_tokens, 0) + 
      COALESCE(NEW.output_tokens, 0),
    total_cost = total_cost + COALESCE(NEW.cost, 0.0),
    updated_at = unixepoch()
  WHERE id = NEW.conversation_id;
END;

-- =============================================================================
-- ATTACHMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image', 'document', 'file')),
  name TEXT NOT NULL,
  size INTEGER NOT NULL CHECK(size >= 0),
  mime_type TEXT NOT NULL,
  base64_data TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  FOREIGN KEY (message_id) REFERENCES messages(id) 
    ON DELETE CASCADE
);

-- Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_attachments_message_id 
  ON attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_attachments_type 
  ON attachments(type);

CREATE INDEX IF NOT EXISTS idx_attachments_size 
  ON attachments(size);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Conversation with message count and latest message
CREATE VIEW IF NOT EXISTS conversations_with_stats AS
SELECT 
  c.*,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at,
  (
    SELECT content 
    FROM messages 
    WHERE conversation_id = c.id 
    ORDER BY created_at DESC 
    LIMIT 1
  ) as last_message_preview
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
GROUP BY c.id;

-- Message with attachment count
CREATE VIEW IF NOT EXISTS messages_with_attachments AS
SELECT 
  m.*,
  COUNT(a.id) as attachment_count
FROM messages m
LEFT JOIN attachments a ON m.id = a.message_id
GROUP BY m.id;
