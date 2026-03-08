/**
 * Import — Shared Types
 * Sprint 33.0 / EPIC-81: Cross-Platform Conversation Memory Import
 */

export type ImportFormat =
  | 'claude_ai_export'
  | 'chatgpt_export'
  | 'gemini_export'
  | 'generic_json'
  | 'markdown'
  | 'text';

export interface ImportedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
}

export interface ImportedConversation {
  /** Original platform conversation ID — used for deduplication */
  external_id: string;
  /** Source platform identifier: 'claude_ai' | 'chatgpt' | 'gemini' | 'generic' | etc. */
  source_platform: string;
  title: string;
  created_at: number; // unix ms
  messages: ImportedMessage[];
}

export interface ImportSource {
  id: string;
  display_name: string;
  source_type: string;
  conversation_count: number;
  chunk_count: number;
  last_synced_at: number | null;
  created_at: number;
}

export interface ImportProgress {
  total: number;
  processed: number;
  skipped: number;
  chunks_written: number;
  status: 'running' | 'complete' | 'error';
  error?: string;
}
