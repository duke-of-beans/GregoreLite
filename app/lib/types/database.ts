/**
 * Database schema types
 * Source: prompts/Results/INSTANCE2_CODEBASE/lib/db/types.ts
 */

import { UUID, Timestamp } from './domain';

// SQLite table schemas

export interface ConversationRow {
  id: UUID;
  title: string;
  model: string;
  model_tier: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  archived: number; // SQLite boolean (0 or 1)
  pinned: number; // SQLite boolean (0 or 1)
  total_tokens: number;
  total_cost: number;
}

export interface MessageRow {
  id: UUID;
  conversation_id: UUID;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  created_at: Timestamp;
}

export interface AttachmentRow {
  id: UUID;
  message_id: UUID;
  type: 'image' | 'document' | 'file';
  name: string;
  size: number;
  mime_type: string;
  base64_data: string;
  created_at: Timestamp;
}

// Database connection type
export interface Database {
  conversations: {
    create: (data: Partial<ConversationRow>) => ConversationRow;
    findById: (id: UUID) => ConversationRow | null;
    findAll: () => ConversationRow[];
    update: (id: UUID, data: Partial<ConversationRow>) => void;
    delete: (id: UUID) => void;
  };
  messages: {
    create: (data: Partial<MessageRow>) => MessageRow;
    findByConversation: (conversationId: UUID) => MessageRow[];
    delete: (id: UUID) => void;
  };
  attachments: {
    create: (data: Partial<AttachmentRow>) => AttachmentRow;
    findByMessage: (messageId: UUID) => AttachmentRow[];
  };
}
