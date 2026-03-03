/**
 * POST /api/auto-title
 *
 * Sprint 10.5 Task 5 — generate a 3-6 word conversation title from the
 * first user message using Haiku. Called fire-and-forget from ChatInterface
 * after the first assistant response on a new conversation.
 *
 * Fail-open: always returns 200 with { title: "Untitled" } on any error so
 * the caller never needs to handle failures.
 */

import Anthropic from '@anthropic-ai/sdk';
import { successResponse, parseRequestBody } from '@/lib/api/utils';
import { NextResponse } from 'next/server';

const client = new Anthropic();

const SYSTEM_PROMPT =
  'You generate concise conversation titles. Return only the title text, 3-6 words, no quotes or punctuation.';

interface AutoTitleRequest {
  message: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const bodyResult = await parseRequestBody<AutoTitleRequest>(request);
    if (!bodyResult.ok || !bodyResult.data.message?.trim()) {
      return successResponse({ title: 'Untitled' }, 200);
    }

    const { message } = bodyResult.data;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message.slice(0, 500) }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock?.type === 'text' ? textBlock.text.trim() : '';
    const title = raw || 'Untitled';

    return successResponse({ title }, 200);
  } catch (err) {
    // Fail-open — never block the UI
    console.warn('[auto-title] Haiku call failed:', err instanceof Error ? err.message : err);
    return successResponse({ title: 'Untitled' }, 200);
  }
}
