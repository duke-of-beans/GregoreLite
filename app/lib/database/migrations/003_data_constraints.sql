-- Migration 003: Advanced Data Constraints
-- Created: January 15, 2026
-- Description: Add business logic constraints and data validation rules

-- =============================================================================
-- CONVERSATION CONSTRAINTS
-- =============================================================================

-- Ensure title is not empty
CREATE TRIGGER IF NOT EXISTS check_conversation_title_not_empty
  BEFORE INSERT ON conversations
BEGIN
  SELECT CASE
    WHEN trim(NEW.title) = '' THEN
      RAISE(ABORT, 'Conversation title cannot be empty')
  END;
END;

CREATE TRIGGER IF NOT EXISTS check_conversation_title_not_empty_update
  BEFORE UPDATE ON conversations
BEGIN
  SELECT CASE
    WHEN trim(NEW.title) = '' THEN
      RAISE(ABORT, 'Conversation title cannot be empty')
  END;
END;

-- Ensure timestamps are in valid range (not in future)
CREATE TRIGGER IF NOT EXISTS check_conversation_timestamps
  BEFORE INSERT ON conversations
BEGIN
  SELECT CASE
    WHEN NEW.created_at > unixepoch() + 60 THEN
      RAISE(ABORT, 'Conversation created_at cannot be in the future')
  END;
END;

-- Ensure model is not empty
CREATE TRIGGER IF NOT EXISTS check_conversation_model_not_empty
  BEFORE INSERT ON conversations
BEGIN
  SELECT CASE
    WHEN trim(NEW.model) = '' THEN
      RAISE(ABORT, 'Conversation model cannot be empty')
  END;
END;

-- =============================================================================
-- MESSAGE CONSTRAINTS
-- =============================================================================

-- Ensure message content is not empty
CREATE TRIGGER IF NOT EXISTS check_message_content_not_empty
  BEFORE INSERT ON messages
BEGIN
  SELECT CASE
    WHEN trim(NEW.content) = '' THEN
      RAISE(ABORT, 'Message content cannot be empty')
  END;
END;

-- Ensure message timestamps are in valid range
CREATE TRIGGER IF NOT EXISTS check_message_timestamps
  BEFORE INSERT ON messages
BEGIN
  SELECT CASE
    WHEN NEW.created_at > unixepoch() + 60 THEN
      RAISE(ABORT, 'Message created_at cannot be in the future')
  END;
END;

-- Ensure token values are consistent
CREATE TRIGGER IF NOT EXISTS check_message_token_consistency
  BEFORE INSERT ON messages
BEGIN
  SELECT CASE
    -- If we have tokens, we should have a model
    WHEN (NEW.input_tokens IS NOT NULL OR NEW.output_tokens IS NOT NULL) 
         AND NEW.model IS NULL THEN
      RAISE(ABORT, 'Message with token counts must specify a model')
    -- If we have a cost, we should have tokens
    WHEN NEW.cost IS NOT NULL 
         AND NEW.input_tokens IS NULL 
         AND NEW.output_tokens IS NULL THEN
      RAISE(ABORT, 'Message with cost must specify token counts')
  END;
END;

-- =============================================================================
-- ATTACHMENT CONSTRAINTS
-- =============================================================================

-- Ensure attachment name is not empty
CREATE TRIGGER IF NOT EXISTS check_attachment_name_not_empty
  BEFORE INSERT ON attachments
BEGIN
  SELECT CASE
    WHEN trim(NEW.name) = '' THEN
      RAISE(ABORT, 'Attachment name cannot be empty')
  END;
END;

-- Ensure MIME type is not empty
CREATE TRIGGER IF NOT EXISTS check_attachment_mime_not_empty
  BEFORE INSERT ON attachments
BEGIN
  SELECT CASE
    WHEN trim(NEW.mime_type) = '' THEN
      RAISE(ABORT, 'Attachment mime_type cannot be empty')
  END;
END;

-- Ensure base64 data is not empty
CREATE TRIGGER IF NOT EXISTS check_attachment_data_not_empty
  BEFORE INSERT ON attachments
BEGIN
  SELECT CASE
    WHEN trim(NEW.base64_data) = '' THEN
      RAISE(ABORT, 'Attachment base64_data cannot be empty')
  END;
END;

-- Ensure attachment size matches type expectations
CREATE TRIGGER IF NOT EXISTS check_attachment_size_reasonable
  BEFORE INSERT ON attachments
BEGIN
  SELECT CASE
    -- Images should generally be under 10MB
    WHEN NEW.type = 'image' AND NEW.size > 10485760 THEN
      RAISE(ABORT, 'Image attachment size exceeds 10MB limit')
    -- Documents should generally be under 50MB
    WHEN NEW.type = 'document' AND NEW.size > 52428800 THEN
      RAISE(ABORT, 'Document attachment size exceeds 50MB limit')
    -- General files should be under 100MB
    WHEN NEW.type = 'file' AND NEW.size > 104857600 THEN
      RAISE(ABORT, 'File attachment size exceeds 100MB limit')
    -- No zero-byte files
    WHEN NEW.size = 0 THEN
      RAISE(ABORT, 'Attachment size cannot be zero')
  END;
END;

-- =============================================================================
-- REFERENTIAL INTEGRITY HELPERS
-- =============================================================================

-- Prevent deletion of conversations with messages (soft delete only)
CREATE TRIGGER IF NOT EXISTS prevent_conversation_deletion_with_messages
  BEFORE DELETE ON conversations
BEGIN
  SELECT CASE
    WHEN EXISTS(SELECT 1 FROM messages WHERE conversation_id = OLD.id) THEN
      RAISE(ABORT, 'Cannot delete conversation with messages. Use archive instead.')
  END;
END;

-- Update conversation updated_at when messages change
CREATE TRIGGER IF NOT EXISTS messages_update_conversation_timestamp
  AFTER UPDATE ON messages
BEGIN
  UPDATE conversations
  SET updated_at = unixepoch()
  WHERE id = NEW.conversation_id;
END;

-- Update conversation stats when message tokens are updated
CREATE TRIGGER IF NOT EXISTS messages_update_conversation_stats_on_update
  AFTER UPDATE OF input_tokens, output_tokens, cost ON messages
BEGIN
  UPDATE conversations
  SET 
    total_tokens = total_tokens 
      - COALESCE(OLD.input_tokens, 0) 
      - COALESCE(OLD.output_tokens, 0)
      + COALESCE(NEW.input_tokens, 0) 
      + COALESCE(NEW.output_tokens, 0),
    total_cost = total_cost 
      - COALESCE(OLD.cost, 0.0) 
      + COALESCE(NEW.cost, 0.0),
    updated_at = unixepoch()
  WHERE id = NEW.conversation_id;
END;

-- Update conversation stats when messages are deleted
CREATE TRIGGER IF NOT EXISTS messages_update_conversation_stats_on_delete
  AFTER DELETE ON messages
BEGIN
  UPDATE conversations
  SET 
    total_tokens = total_tokens 
      - COALESCE(OLD.input_tokens, 0) 
      - COALESCE(OLD.output_tokens, 0),
    total_cost = total_cost - COALESCE(OLD.cost, 0.0),
    updated_at = unixepoch()
  WHERE id = OLD.conversation_id;
END;
