/**
 * AI SDK Service
 *
 * Thin wrapper around Vercel AI SDK for GREGORE integration.
 * Handles provider selection, cost tracking, and standardized responses.
 *
 * This replaces 860 lines of custom provider code with battle-tested infrastructure.
 *
 * References:
 * - LEAN-OUT Migration (replacing custom AI service)
 * - Vercel AI SDK: https://sdk.vercel.ai/docs
 */

import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { calculateCost } from './pricing';

// NOTE: @ai-sdk/openai removed from deps in Sprint 14.0 (GregLite is Claude-only).
// This file is dead code — not imported anywhere. Re-add if multi-model support is needed.
// openai provider loaded lazily to avoid webpack resolution failure.
let _openai: ((model: string) => unknown) | null = null;
async function getOpenAI(model: string) {
  if (!_openai) {
    const modName = '@ai-sdk/openai';
    const mod = await import(/* webpackIgnore: true */ modName);
    _openai = mod.openai;
  }
  return _openai!(model);
}

/**
 * Supported AI providers
 */
export type AIProvider = 'anthropic' | 'openai' | 'google' | 'xai' | 'deepseek';

/**
 * Model tier for routing
 */
export type ModelTier = 'haiku' | 'sonnet' | 'opus';

/**
 * AI request configuration
 */
export interface AIRequest {
  provider: AIProvider;
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/**
 * AI response with usage and cost tracking
 */
export interface AIResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: number;
  latencyMs: number;
  model: string;
  provider: AIProvider;
}

/**
 * Stream callback function
 */
export type StreamCallback = (chunk: string) => void;

/**
 * AI SDK Service
 *
 * Provides unified interface to Vercel AI SDK for all providers.
 * Handles cost tracking and standardized response format.
 */
export class AISDKService {
  /**
   * Complete a conversation (non-streaming)
   */
  async complete(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    const result = await generateText({
      model: await this.getModel(request.provider, request.model),
      prompt: request.prompt,
      ...(request.systemPrompt && { system: request.systemPrompt }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.topP !== undefined && { topP: request.topP }),
    });

    // Wait for usage stats
    const usage = await result.usage;

    return {
      content: result.text,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
      cost: calculateCost(
        request.model,
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0
      ),
      latencyMs: Date.now() - startTime,
      model: request.model,
      provider: request.provider,
    };
  }

  /**
   * Stream a conversation
   */
  async stream(
    request: AIRequest,
    onChunk: StreamCallback
  ): Promise<AIResponse> {
    const startTime = Date.now();
    let accumulated = '';

    const result = await streamText({
      model: await this.getModel(request.provider, request.model),
      prompt: request.prompt,
      ...(request.systemPrompt && { system: request.systemPrompt }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.topP !== undefined && { topP: request.topP }),
    });

    // Stream chunks to callback
    for await (const chunk of result.textStream) {
      accumulated += chunk;
      onChunk(chunk);
    }

    // Wait for final usage stats
    const usage = await result.usage;

    return {
      content: accumulated,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
      cost: calculateCost(
        request.model,
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0
      ),
      latencyMs: Date.now() - startTime,
      model: request.model,
      provider: request.provider,
    };
  }

  /**
   * Get model instance from provider
   */
  private async getModel(provider: AIProvider, model: string) {
    switch (provider) {
      case 'anthropic':
        return anthropic(model);
      case 'openai':
        return await getOpenAI(model) as ReturnType<typeof anthropic>;
      case 'google':
        throw new Error('Google provider not yet configured');
      case 'xai':
        throw new Error('xAI provider not yet configured');
      case 'deepseek':
        throw new Error('DeepSeek provider not yet configured');
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Check if provider is available
   */
  isProviderAvailable(provider: AIProvider): boolean {
    // For now, only Anthropic and OpenAI
    return provider === 'anthropic' || provider === 'openai';
  }

  /**
   * Get supported models for a provider
   */
  getSupportedModels(provider: AIProvider): string[] {
    switch (provider) {
      case 'anthropic':
        return [
          'claude-opus-4-20250514',
          'claude-sonnet-4-20250514',
          'claude-sonnet-4-5-20250929',
          'claude-haiku-4-20250115',
          'claude-haiku-4-5-20251001',
        ];
      case 'openai':
        return ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'];
      default:
        return [];
    }
  }
}
