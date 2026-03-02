/**
 * Decision Gate — Haiku Inference
 *
 * Single-turn Claude Haiku call that evaluates the three structured
 * triggers that require NLP judgment rather than keyword matching:
 *   - high_tradeoff_count   (≥4 major architectural tradeoffs)
 *   - multi_project_touch   (decision affects ≥2 codebases)
 *   - large_build_estimate  (>3 Agent SDK sessions to implement)
 *
 * Cost: ~$0.0005 per call (500 tokens × Haiku rate).
 * Fails open — returns all-false on any error.
 * Called once per analyze() pass; result fanned out to all three triggers.
 *
 * @module lib/decision-gate/inference
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GateMessage } from './types';

const anthropic = new Anthropic();

export interface InferenceResult {
  highTradeoff: boolean;
  multiProject: boolean;
  largeEstimate: boolean;
}

const INFERENCE_FAIL_OPEN: InferenceResult = {
  highTradeoff: false,
  multiProject: false,
  largeEstimate: false,
};

const INFERENCE_PROMPT = (excerpt: string) =>
  `Analyze this conversation excerpt and respond with ONLY this JSON object, no other text:
{"highTradeoff": boolean, "multiProject": boolean, "largeEstimate": boolean}

highTradeoff: true if the conversation involves 4 or more significant architectural tradeoffs being actively weighed against each other.
multiProject: true if the decision being discussed would affect 2 or more distinct codebases or projects simultaneously.
largeEstimate: true if someone mentioned this work would take more than 3 separate work sessions to implement.

Conversation:
${excerpt}`;

/**
 * Run a single Haiku inference pass to evaluate the three structured triggers.
 * Always returns a safe default (all false) on any error.
 */
export async function inferStructuredTriggers(
  messages: GateMessage[],
): Promise<InferenceResult> {
  if (messages.length === 0) return INFERENCE_FAIL_OPEN;

  const excerpt = messages
    .slice(-5)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: 'You analyze conversations and detect decision complexity. Respond only with valid JSON.',
      messages: [{ role: 'user', content: INFERENCE_PROMPT(excerpt) }],
    });

    const block = response.content[0];
    const text = block?.type === 'text' ? block.text.trim() : '{}';

    // Strip any markdown code fences Haiku might wrap around JSON
    const clean = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(clean) as Partial<InferenceResult>;

    return {
      highTradeoff: parsed.highTradeoff === true,
      multiProject: parsed.multiProject === true,
      largeEstimate: parsed.largeEstimate === true,
    };
  } catch {
    // Fail open — never block conversation due to inference unavailability
    return INFERENCE_FAIL_OPEN;
  }
}
