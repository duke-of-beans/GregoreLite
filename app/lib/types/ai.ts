/**
 * AI service types
 * Source: prompts/Results/INSTANCE2_CODEBASE/lib/ai-response/types.ts
 */

import { ModelTier } from './domain';

export interface AIModelConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';
  model: string;
  tier: ModelTier;
  maxTokens: number;
  temperature: number;
  topP?: number;
}

export interface AIRequest {
  messages: AIMessage[];
  model: AIModelConfig;
  stream?: boolean;
  systemPrompt?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: number;
  finishReason: 'stop' | 'length' | 'error';
}

export interface AIStreamChunk {
  delta: string;
  accumulated: string;
  done: boolean;
}

export type AIStreamCallback = (chunk: AIStreamChunk) => void;
