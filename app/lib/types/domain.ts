/**
 * Core domain types for GREGORE
 * Professional engineering naming - no whimsy, no AI vibes
 */

export type UUID = string;
export type Timestamp = number;

// Quality gates (V0-V5 confidence scoring)
export type ConfidenceLevel = 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5';

// User trust progression (T0-T5)
export type TrustTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

// System execution modes
export type ExecutionMode =
  | 'idle'
  | 'active'
  | 'building'
  | 'exploring'
  | 'reviewing';

// AI model performance tiers
export type ModelTier = 'fast' | 'balanced' | 'advanced';

export interface Entity {
  id: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Conversation domain types
export interface Message extends Entity {
  conversationId: UUID;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  cost?: number;
  streaming?: boolean;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: UUID;
  type: 'image' | 'document' | 'file';
  name: string;
  size: number;
  mimeType: string;
  base64Data: string;
}

export interface Conversation extends Entity {
  title: string;
  messages: Message[];
  model: string;
  modelTier: ModelTier;
  tokenUsage: {
    total: number;
    cost: number;
  };
  archived: boolean;
  pinned: boolean;
  tags?: string[];
}

export interface ConversationSummary {
  id: UUID;
  title: string;
  lastMessageAt: Timestamp;
  messageCount: number;
  model: string;
  preview: string;
}
