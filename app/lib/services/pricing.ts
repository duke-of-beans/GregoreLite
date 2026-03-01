/**
 * Model Pricing
 *
 * Pricing data for all supported models.
 * Used by Metabolism engine for cost tracking.
 *
 * Prices are in USD per 1 million tokens.
 * Updated: January 2026
 *
 * References:
 * - LEAN-OUT Migration (moved from lib/ai/)
 */

/**
 * Cost per 1M tokens (input, output)
 */
export interface ModelCost {
  inputPer1M: number;
  outputPer1M: number;
}

/**
 * Model pricing map
 */
export type ModelPricing = Record<string, ModelCost>;

/**
 * Anthropic Claude pricing
 */
export const ANTHROPIC_PRICING: ModelPricing = {
  // Claude 4 (Opus)
  'claude-opus-4-20250514': {
    inputPer1M: 15.0,
    outputPer1M: 75.0,
  },

  // Claude 4 (Sonnet)
  'claude-sonnet-4-20250514': {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  'claude-sonnet-4-5-20250929': {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },

  // Claude 4 (Haiku)
  'claude-haiku-4-20250115': {
    inputPer1M: 0.8,
    outputPer1M: 4.0,
  },
  'claude-haiku-4-5-20251001': {
    inputPer1M: 0.8,
    outputPer1M: 4.0,
  },

  // Claude 3.5 (legacy)
  'claude-3-5-sonnet-20241022': {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  'claude-3-5-haiku-20241022': {
    inputPer1M: 0.8,
    outputPer1M: 4.0,
  },
};

/**
 * OpenAI GPT pricing
 */
export const OPENAI_PRICING: ModelPricing = {
  // GPT-4o
  'gpt-4o': {
    inputPer1M: 2.5,
    outputPer1M: 10.0,
  },
  'gpt-4o-2024-11-20': {
    inputPer1M: 2.5,
    outputPer1M: 10.0,
  },

  // GPT-4o mini
  'gpt-4o-mini': {
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
  'gpt-4o-mini-2024-07-18': {
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },

  // O1 series
  'o1-preview': {
    inputPer1M: 15.0,
    outputPer1M: 60.0,
  },
  'o1-mini': {
    inputPer1M: 3.0,
    outputPer1M: 12.0,
  },
};

/**
 * Google Gemini pricing
 */
export const GOOGLE_PRICING: ModelPricing = {
  // Gemini 2.0
  'gemini-2.0-flash-exp': {
    inputPer1M: 0.0, // Free during preview
    outputPer1M: 0.0,
  },

  // Gemini 1.5
  'gemini-1.5-pro': {
    inputPer1M: 1.25,
    outputPer1M: 5.0,
  },
  'gemini-1.5-flash': {
    inputPer1M: 0.075,
    outputPer1M: 0.3,
  },
  'gemini-1.5-flash-8b': {
    inputPer1M: 0.0375,
    outputPer1M: 0.15,
  },
};

/**
 * xAI Grok pricing
 */
export const XAI_PRICING: ModelPricing = {
  'grok-beta': {
    inputPer1M: 5.0,
    outputPer1M: 15.0,
  },
  'grok-vision-beta': {
    inputPer1M: 5.0,
    outputPer1M: 15.0,
  },
};

/**
 * DeepSeek pricing
 */
export const DEEPSEEK_PRICING: ModelPricing = {
  'deepseek-chat': {
    inputPer1M: 0.14,
    outputPer1M: 0.28,
  },
  'deepseek-reasoner': {
    inputPer1M: 0.55,
    outputPer1M: 2.19,
  },
};

/**
 * All pricing combined
 */
export const ALL_PRICING: ModelPricing = {
  ...ANTHROPIC_PRICING,
  ...OPENAI_PRICING,
  ...GOOGLE_PRICING,
  ...XAI_PRICING,
  ...DEEPSEEK_PRICING,
};

/**
 * Calculate cost for token usage
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = ALL_PRICING[model];
  if (!pricing) {
    console.warn(`No pricing data for model: ${model}`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

  return inputCost + outputCost;
}

/**
 * Get pricing for a model
 */
export function getModelPricing(model: string): ModelPricing[string] | null {
  return ALL_PRICING[model] || null;
}
