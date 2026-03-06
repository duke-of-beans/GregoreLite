/**
 * lib/synthesis/master.ts — Sprint 28.0 Ceremonial Onboarding
 *
 * generateMasterSynthesis(): the centrepiece of Sprint 28.
 * Called when all non-skipped sources are complete.
 *
 * This is the moment Greg truly sees the user for the first time.
 * Quality of the prompt engineering here is the most important work in this sprint.
 *
 * Voice: Deadpan professional. Genuinely insightful. Worthy of the trust.
 * "I see you now." — not "Amazing data! Here's everything!"
 */

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { getDatabase } from '@/lib/kernl/database';
import type { IndexingSource, MasterSynthesis } from './types';

// ── Claude client ─────────────────────────────────────────────────────────────

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

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParsedMaster {
  overview: string;
  patterns: string[];
  insights: string[];
  blind_spots: string[];
  capability_summary: string;
}

function parseMasterResponse(text: string): ParsedMaster {
  // Expected structure (strict headers):
  //   OVERVIEW: <2-3 sentence paragraph>
  //   PATTERNS: <list>
  //   INSIGHTS: <list>
  //   BLIND_SPOTS: <list>
  //   CAPABILITIES: <paragraph>

  const extract = (header: string, nextHeader?: string): string => {
    const pattern = nextHeader
      ? new RegExp(`${header}:\\s*([\\s\\S]*?)(?=${nextHeader}:|$)`, 'i')
      : new RegExp(`${header}:\\s*([\\s\\S]*)`, 'i');
    return (text.match(pattern)?.[1]?.trim()) ?? '';
  };

  const parseList = (raw: string): string[] =>
    raw
      .split('\n')
      .map((line) => line.replace(/^[-*\d.•]\s*/, '').trim())
      .filter((line) => line.length > 10); // discard noise

  const overview          = extract('OVERVIEW', 'PATTERNS');
  const patternsRaw       = extract('PATTERNS', 'INSIGHTS');
  const insightsRaw       = extract('INSIGHTS', 'BLIND_SPOTS');
  const blindSpotsRaw     = extract('BLIND_SPOTS', 'CAPABILITIES');
  const capabilitySummary = extract('CAPABILITIES');

  return {
    overview:           overview || (text.split('\n')[0] ?? ''),
    patterns:           parseList(patternsRaw).slice(0, 5),
    insights:           parseList(insightsRaw).slice(0, 3),
    blind_spots:        parseList(blindSpotsRaw).slice(0, 2),
    capability_summary: capabilitySummary,
  };
}

// ── Source description builder ────────────────────────────────────────────────

function describeSource(source: IndexingSource): string {
  return `${source.label} (${source.indexed_count.toLocaleString()} items)`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate Greg's master synthesis across all completed sources.
 * This is a one-time, high-value synthesis. Uses claude-sonnet for quality.
 * Stores the result in the master_synthesis table.
 */
export async function generateMasterSynthesis(
  sources: IndexingSource[],
): Promise<MasterSynthesis> {
  const db = getDatabase();
  const client = getClient();

  const completedSources = sources.filter(
    (s) => s.status === 'complete',
  );

  const totalItems = completedSources.reduce(
    (sum, s) => sum + s.indexed_count,
    0,
  );

  const sourceList = completedSources.map(describeSource).join(', ');
  const sourceCount = completedSources.length;

  // ── System prompt (the most important engineering in this sprint) ─────────

  const systemPrompt =
    `You are Greg, a cognitive operating system. You've now fully indexed a user's digital life across ${sourceCount} source${sourceCount !== 1 ? 's' : ''}: ${sourceList}. ` +
    `Total items in your knowledge base: ${totalItems.toLocaleString()}.\n\n` +
    `Deliver a master synthesis — a clear, outside-looking-in view of their life and work. ` +
    `Identify patterns they probably haven't noticed about themselves. Be specific. Cite data where you can. ` +
    `This is the moment you truly see them for the first time. Be worthy of the trust they've placed in you.\n\n` +
    `Voice rules (non-negotiable):\n` +
    `- Deadpan professional. No sentimentality. No exclamation marks. No "Amazing!"\n` +
    `- Lead with specifics, not generalities. "You've shipped 12 projects in 18 months" not "You're productive."\n` +
    `- The most valuable insights are the ones the user can't see from inside their own perspective.\n` +
    `- Blind spots section must be honest — if data is thin somewhere, say so plainly.\n` +
    `- Capabilities section should feel concrete and actionable, not like a feature list.\n\n` +
    `Structure your response with exactly these headers:\n` +
    `OVERVIEW: (2-3 sentences. The single most important thing you notice about how this person works and thinks.)\n` +
    `PATTERNS: (3-5 patterns. Each as one line. Lead with evidence. "You [specific pattern].")\n` +
    `INSIGHTS: (2-3 things that might surprise them. Each as one line. Things they probably don't see about themselves.)\n` +
    `BLIND_SPOTS: (1-2 data gaps that matter. Not a guilt trip — just what you can't see yet and why it matters.)\n` +
    `CAPABILITIES: (2-3 sentences describing what you can now do for them with this combined data. Concrete and specific.)`;

  const userPrompt =
    `I've finished indexing all my sources. What do you see?`;

  // ── Generate a pending record first (UI can show loading state) ───────────

  const synthesisId = randomUUID();

  db.prepare(`
    INSERT INTO master_synthesis (id, status, generated_at)
    VALUES (?, 'generating', ?)
  `).run(synthesisId, Date.now());

  // ── Call Claude API (Sonnet for quality — this is the centrepiece) ────────

  let rawText: string;
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n');
  } catch (err) {
    // Mark as error but don't lose the record
    db.prepare(`
      UPDATE master_synthesis SET status = 'error' WHERE id = ?
    `).run(synthesisId);
    throw err;
  }

  const parsed = parseMasterResponse(rawText);
  const sourcesUsed = completedSources.map((s) => s.id);

  // ── Persist ───────────────────────────────────────────────────────────────

  db.prepare(`
    UPDATE master_synthesis
    SET overview           = ?,
        patterns           = ?,
        insights           = ?,
        blind_spots        = ?,
        capability_summary = ?,
        sources_used       = ?,
        status             = 'complete',
        generated_at       = ?
    WHERE id = ?
  `).run(
    parsed.overview,
    JSON.stringify(parsed.patterns),
    JSON.stringify(parsed.insights),
    JSON.stringify(parsed.blind_spots),
    parsed.capability_summary,
    JSON.stringify(sourcesUsed),
    Date.now(),
    synthesisId,
  );

  return {
    id: synthesisId,
    overview: parsed.overview,
    patterns: parsed.patterns,
    insights: parsed.insights,
    blind_spots: parsed.blind_spots,
    capability_summary: parsed.capability_summary,
    sources_used: sourcesUsed,
    generated_at: Date.now(),
    status: 'complete',
  };
}

/**
 * Load the most recent completed master synthesis from the DB.
 * Returns null if none exists yet.
 */
export function loadMasterSynthesis(): MasterSynthesis | null {
  const db = getDatabase();

  type Row = {
    id: string;
    overview: string;
    patterns: string;
    insights: string;
    blind_spots: string;
    capability_summary: string;
    sources_used: string;
    status: string;
    generated_at: number;
  };

  const row = db.prepare<[], Row>(`
    SELECT * FROM master_synthesis
    WHERE status = 'complete'
    ORDER BY generated_at DESC
    LIMIT 1
  `).get() as Row | undefined;

  if (!row) return null;

  return {
    id: row.id,
    overview: row.overview,
    patterns: JSON.parse(row.patterns) as string[],
    insights: JSON.parse(row.insights) as string[],
    blind_spots: JSON.parse(row.blind_spots) as string[],
    capability_summary: row.capability_summary,
    sources_used: JSON.parse(row.sources_used) as string[],
    generated_at: row.generated_at,
    status: 'complete',
  };
}
