/**
 * Artifact Detector — Sprint 2D
 *
 * Parses a Claude response string and extracts the most significant code block.
 * "Most significant" = the largest by character count among all fenced blocks.
 *
 * Called on every assistant response in ChatInterface after setting message state.
 */

import { nanoid } from 'nanoid';
import type { Artifact, ArtifactType } from './types';

/** Minimum content length (chars) before we bother opening an artifact panel */
const MIN_ARTIFACT_LENGTH = 50;

/**
 * Map a code fence language tag to an ArtifactType.
 * Unknown tags fall through to 'code' (Monaco will handle most languages).
 */
function resolveType(lang: string): ArtifactType {
  const l = lang.toLowerCase();
  if (l === 'markdown' || l === 'md') return 'markdown';
  if (l === 'jsx' || l === 'tsx') return 'react';
  if (l === 'html') return 'html';
  if (l === 'mermaid') return 'mermaid';
  if (l === '') return 'unknown';
  return 'code';
}

/**
 * Extract the largest fenced code block from a Claude response.
 * Returns null if no block meets the minimum length threshold.
 */
export function detectArtifact(content: string): Artifact | null {
  // Match ``` optionally followed by a language tag, then content, then ```
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let largest: Artifact | null = null;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const rawLang = match[1] ?? '';
    const code = match[2];

    if (!code || code.length < MIN_ARTIFACT_LENGTH) continue;

    if (!largest || code.length > largest.content.length) {
      largest = {
        id: nanoid(),
        type: resolveType(rawLang),
        language: rawLang || 'text',
        content: code,
      };
    }
  }

  return largest;
}
