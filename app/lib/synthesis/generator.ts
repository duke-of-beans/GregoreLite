/**
 * lib/synthesis/generator.ts — Sprint 28.0 Ceremonial Onboarding
 *
 * generateSourceSynthesis(): calls Claude API to synthesise what Greg found
 * in a newly-indexed source, and what NEW capabilities are unlocked when
 * combined with previously-indexed sources.
 *
 * Cost: ~$0.05-0.10 per synthesis. One-time per source. Worth it.
 * Voice: Deadpan professional. No exclamation marks. Data-forward.
 * See GREGORE_AUDIT.md §1.
 */

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { getDatabase } from '@/lib/kernl/database';
import type { IndexingSource, SynthesisResult } from './types';

// ── Claude client (lazy init) ─────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const db = getDatabase();
    const row = db
      .prepare(`SELECT value FROM settings WHERE key = 'api_key' LIMIT 1`)
      .get() as { value: string } | undefined;
    const apiKey = row?.value ?? process.env.ANTHROPIC_API_KEY ?? '';
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function sourceTypeLabel(type: IndexingSource['type']): string {
  const labels: Record<IndexingSource['type'], string> = {
    local_files:   'local files',
    projects:      'registered projects',
    email:         'email',
    conversations: 'past conversations',
    calendar:      'calendar',
    notes:         'notes',
    custom:        'custom data source',
  };
  return labels[type] ?? type;
}

function sourceSummary(source: IndexingSource): string {
  const count = source.indexed_count;
  return `${sourceTypeLabel(source.type)} (${count.toLocaleString()} items indexed)`;
}

// ── Response parser ───────────────────────────────────────────────────────────

interface ParsedSynthesis {
  sourceSynthesis: string;
  combinationSynthesis: string | null;
  capabilitiesUnlocked: string[];
}

function parseSynthesisResponse(
  text: string,
  hasPrevious: boolean,
): ParsedSynthesis {
  // Expected structure when previous sources exist:
  //   SOURCE_SYNTHESIS: <text>
  //   COMBINATION_SYNTHESIS: <text>
  //   CAPABILITIES: <bullet list>
  //
  // Without previous sources, only SOURCE_SYNTHESIS and CAPABILITIES.

  const sourceMatch = text.match(/SOURCE_SYNTHESIS:\s*([\s\S]*?)(?=COMBINATION_SYNTHESIS:|CAPABILITIES:|$)/i);
  const combinationMatch = text.match(/COMBINATION_SYNTHESIS:\s*([\s\S]*?)(?=CAPABILITIES:|$)/i);
  const capabilitiesMatch = text.match(/CAPABILITIES:\s*([\s\S]*?)$/i);

  const sourceSynthesis = sourceMatch?.[1]?.trim() ?? text.trim();
  const combinationSynthesis = hasPrevious
    ? (combinationMatch?.[1]?.trim() ?? null)
    : null;

  // Parse capabilities as a list (each line that starts with - or * or number)
  const capText = capabilitiesMatch?.[1]?.trim() ?? '';
  const capabilitiesUnlocked = capText
    .split('\n')
    .map((line) => line.replace(/^[-*\d.]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 5);

  return { sourceSynthesis, combinationSynthesis, capabilitiesUnlocked };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate Greg's synthesis for a newly-completed indexing source.
 * Stores the result directly in the indexing_sources table.
 * Returns the parsed SynthesisResult.
 */
export async function generateSourceSynthesis(
  source: IndexingSource,
  previousSources: IndexingSource[],
): Promise<SynthesisResult> {
  const client = getClient();
  const hasPrevious = previousSources.length > 0;

  // ── Build system prompt ───────────────────────────────────────────────────

  const previousList = previousSources
    .map((s) => sourceSummary(s))
    .join(', ');

  let systemPrompt =
    `You are Greg, a cognitive operating system. You've just finished indexing a user's ${sourceTypeLabel(source.type)}. ` +
    `Total items indexed: ${source.indexed_count.toLocaleString()}. ` +
    `Provide a brief, insightful synthesis of what you found — patterns, notable items, and what capabilities this data enables. ` +
    `Be direct, data-forward, genuinely thoughtful. No exclamation marks. No filler phrases. No "Great!" or "Wow!". ` +
    `Address the user directly. Lead with what's interesting, not with pleasantries.`;

  if (hasPrevious) {
    systemPrompt +=
      `\n\nYou previously indexed: ${previousList}. ` +
      `After your source analysis, explain what NEW capabilities are unlocked by COMBINING this new source ` +
      `with the existing data. Be specific — name concrete things you can now do that weren't possible before. ` +
      `Do not repeat what you said about the source alone.`;
  }

  // ── Build user prompt ─────────────────────────────────────────────────────

  const structureInstructions = hasPrevious
    ? `Structure your response with these exact headers:\n` +
      `SOURCE_SYNTHESIS: (your analysis of this source alone — 2-4 sentences)\n` +
      `COMBINATION_SYNTHESIS: (what combining with previous sources specifically unlocks — 2-3 sentences)\n` +
      `CAPABILITIES: (bullet list of 3-5 concrete new abilities, one per line)`
    : `Structure your response with these exact headers:\n` +
      `SOURCE_SYNTHESIS: (your analysis of this source — 2-4 sentences)\n` +
      `CAPABILITIES: (bullet list of 2-4 concrete abilities this enables, one per line)`;

  const userPrompt =
    `I've just finished indexing my ${sourceTypeLabel(source.type)}. ` +
    `${source.indexed_count.toLocaleString()} items were processed. ` +
    `What do you see?\n\n${structureInstructions}`;

  // ── Call Claude API ───────────────────────────────────────────────────────

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',   // cost-optimised for synthesis
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n');

  const parsed = parseSynthesisResponse(rawText, hasPrevious);

  // ── Persist to DB ─────────────────────────────────────────────────────────

  const db = getDatabase();
  db.prepare(`
    UPDATE indexing_sources
    SET synthesis_text   = ?,
        combination_text = ?
    WHERE id = ?
  `).run(
    parsed.sourceSynthesis,
    parsed.combinationSynthesis,
    source.id,
  );

  return {
    sourceId: source.id,
    sourceSynthesis: parsed.sourceSynthesis,
    combinationSynthesis: parsed.combinationSynthesis,
    capabilitiesUnlocked: parsed.capabilitiesUnlocked,
  };
}

/**
 * Build a "capability teaser" for a skipped source — used by the nudge system.
 * Lightweight: no API call, uses a lookup table.
 */
export function getCapabilityTeaser(
  skippedType: IndexingSource['type'],
  existingTypes: IndexingSource['type'][],
): string {
  const teasers: Partial<Record<IndexingSource['type'], string>> = {
    email:         'answer questions about past conversations, find contact history, and surface relevant threads',
    calendar:      'know about your upcoming meetings, flag scheduling conflicts, and track time commitments',
    conversations: 'recall decisions you made in past sessions and surface relevant context automatically',
    local_files:   'search your documents, find relevant research, and cross-reference your written work',
    projects:      'track project status, surface blockers, and correlate work patterns across codebases',
    notes:         'find relevant notes, connect ideas across your knowledge base, and surface forgotten context',
    custom:        'cross-reference this data with everything else I know about your work',
  };

  void existingTypes; // future: tailor teaser based on combination with existing sources
  return teasers[skippedType] ?? 'expand what I can help you with';
}

export { randomUUID };
