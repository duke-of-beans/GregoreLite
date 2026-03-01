// Continuity module types — diff-based crash recovery

export interface DiffMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  timestamp: number;
}

/**
 * Minimal diff between conversation states.
 * Only newly added messages since last checkpoint — not a full dump.
 */
export interface ConversationDiff {
  threadId: string;
  timestamp: number;
  addedMessages: DiffMessage[];
  updatedMetadata?: {
    lastActive: number;
    contextHash?: string;
  };
}

/**
 * Reconstructed conversation state returned on boot restore.
 */
export interface RestoredConversation {
  threadId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  lastActive: number;
}
