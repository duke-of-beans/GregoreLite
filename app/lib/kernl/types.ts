// KERNL Type Definitions — all SQLite row shapes + application types

export interface Thread {
  id: string;
  title: string;
  project_id: string | null;
  created_at: number;
  updated_at: number;
  meta: string | null;
}

export interface Message {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  created_at: number;
  meta: string | null;
}

export interface Decision {
  id: string;
  thread_id: string | null;
  category: string;
  title: string;
  rationale: string;
  alternatives: string | null; // JSON array
  impact: 'high' | 'medium' | 'low' | null;
  created_at: number;
  meta: string | null;
}

export interface Project {
  id: string;
  name: string;
  path: string | null;
  description: string | null;
  status: 'active' | 'archived' | 'paused';
  created_at: number;
  updated_at: number;
  meta: string | null;
}

export interface Artifact {
  id: string;
  thread_id: string | null;
  project_id: string | null;
  type: 'file' | 'snippet' | 'diagram' | 'plan';
  title: string;
  content: string;
  language: string | null;
  file_path: string | null;
  created_at: number;
  meta: string | null;
}

export interface Checkpoint {
  id: string;
  thread_id: string;
  message_id: string | null;
  snapshot: string; // JSON
  created_at: number;
}

export interface Workstream {
  id: string;
  project_id: string | null;
  title: string;
  status: 'active' | 'paused' | 'completed';
  priority: number;
  created_at: number;
  updated_at: number;
  meta: string | null;
}

export interface Pattern {
  id: string;
  name: string;
  description: string | null;
  template: string;
  category: string | null;
  use_count: number;
  created_at: number;
}

// ─── Input types (no id/timestamps — generated internally) ──────────────────

export type CreateThreadInput = Pick<Thread, 'title'> & {
  project_id?: string;
  meta?: Record<string, unknown>;
};

export type CreateMessageInput = Pick<Message, 'thread_id' | 'role' | 'content'> & {
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
  meta?: Record<string, unknown>;
};

export type CreateDecisionInput = Pick<Decision, 'category' | 'title' | 'rationale'> & {
  thread_id?: string;
  alternatives?: string[];
  impact?: Decision['impact'];
  meta?: Record<string, unknown>;
};

export type CreateProjectInput = Pick<Project, 'name'> & {
  path?: string;
  description?: string;
  meta?: Record<string, unknown>;
};

export type CreateCheckpointInput = {
  thread_id: string;
  message_id?: string;
  snapshot: object;
};
