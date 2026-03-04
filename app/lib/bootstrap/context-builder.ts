import { getDatabase } from '@/lib/kernl/database';
import { listThreads } from '@/lib/kernl/session-manager';
import type { ContextPackage, KERNLContext, KERNLDecision, KERNLProject, DevProtocols } from './types';

const DEFAULT_SYSTEM_PROMPT =
  `You are GregLite, a personal cognitive operating system. You are direct, concise, and technically precise.

IMPORTANT: Respond conversationally to casual messages like greetings, short questions, or chitchat. Do NOT auto-execute bootstrap sequences, file reads, environment detection, or load any instruction files unless the user explicitly requests work on a specific project, codebase, or task. If the user says "hey", "you there", "what's up", or similar, just respond naturally as a conversational partner.

When the user DOES request specific work, then engage your full capabilities. You are Claude, acting as COO to the user's CEO role. Be direct, intelligent, and execution-focused.`;

/**
 * Query KERNL for current context: active projects, recent decisions, last session.
 */
export function buildKERNLContext(): KERNLContext {
  try {
    const db = getDatabase();

    // Active projects
    const projects = db.prepare(
      "SELECT id, name, path, description, status FROM projects WHERE status = 'active' ORDER BY updated_at DESC LIMIT 10"
    ).all() as KERNLProject[];

    // Last 5 decisions
    const rawDecisions = db.prepare(
      'SELECT id, category, title, rationale, created_at FROM decisions ORDER BY created_at DESC LIMIT 5'
    ).all() as Array<{ id: string; category: string; title: string; rationale: string; created_at: number }>;

    const recentDecisions: KERNLDecision[] = rawDecisions.map((d) => ({
      id: d.id,
      category: d.category,
      decision: d.title,
      rationale: d.rationale,
      timestamp: d.created_at,
    }));

    // Last session: most recently updated thread
    const threads = listThreads(1);
    const lastThread = threads[0] ?? null;

    return {
      activeProjects: projects,
      recentDecisions,
      lastSessionSummary: lastThread
        ? `Last session: "${lastThread.title}" (${new Date(lastThread.updated_at).toLocaleDateString()})`
        : null,
      activeSession: lastThread?.id ?? null,
    };
  } catch (err) {
    console.warn('[bootstrap:context-builder] KERNL query failed:', err);
    return {
      activeProjects: [],
      recentDecisions: [],
      lastSessionSummary: null,
      activeSession: null,
    };
  }
}

/**
 * Assemble the full system prompt from all context sources.
 */
export function buildSystemPrompt(
  kernlContext: KERNLContext,
  devProtocols: DevProtocols
): string {
  const parts: string[] = [
    'You are GregLite, a personal cognitive operating system.',
    "You function as COO to the user's CEO role.",
    'Be direct, execution-focused, and intelligence-first.',
    '',
    'IMPORTANT: Respond conversationally to casual messages like greetings, short questions, or chitchat.',
    'Do NOT auto-execute bootstrap sequences, file reads, environment detection, or load any instruction files',
    'unless the user explicitly requests work on a specific project, codebase, or task.',
    "If the user says \"hey\", \"what's up\", or similar, just respond naturally.",
    'When the user DOES request specific work, then engage your full capabilities.',
    '',
  ];

  if (devProtocols.technicalStandards) {
    parts.push('=== TECHNICAL STANDARDS ===');
    parts.push(devProtocols.technicalStandards);
    parts.push('');
  }

  if (devProtocols.claudeInstructions) {
    parts.push('=== OPERATING INSTRUCTIONS ===');
    parts.push(devProtocols.claudeInstructions);
    parts.push('');
  }

  if (kernlContext.lastSessionSummary) {
    parts.push('=== LAST SESSION ===');
    parts.push(kernlContext.lastSessionSummary);
    parts.push('');
  }

  if (kernlContext.recentDecisions.length > 0) {
    parts.push('=== RECENT DECISIONS ===');
    kernlContext.recentDecisions.forEach((d) => {
      parts.push(`- [${d.category}] ${d.decision} (${new Date(d.timestamp).toLocaleDateString()})`);
    });
    parts.push('');
  }

  if (kernlContext.activeProjects.length > 0) {
    parts.push('=== ACTIVE PROJECTS ===');
    kernlContext.activeProjects.forEach((p) => {
      parts.push(`- ${p.name}${p.path ? ` (${p.path})` : ''}`);
    });
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Build the complete context package.
 */
export function buildContextPackage(
  devProtocols: DevProtocols,
  startTime: number
): ContextPackage {
  const kernlContext = buildKERNLContext();
  const systemPrompt = buildSystemPrompt(kernlContext, devProtocols);
  const coldStartMs = Date.now() - startTime;

  return {
    systemPrompt,
    kernlContext,
    devProtocols,
    bootstrapTimestamp: Date.now(),
    coldStartMs,
  };
}

// ─── Sprint 12.0: Prompt Caching ─────────────────────────────────────────────

type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

/**
 * Build the system prompt as content blocks with prompt caching.
 *
 * Stable block  (base identity + dev protocols) → cache_control: ephemeral
 *   Re-sent on every request but Anthropic caches after first use (~90% discount).
 *
 * Dynamic block (KERNL context: last session, decisions, projects) → no cache
 *   Changes per session so it must remain un-cached.
 */
export function buildSystemPromptBlocks(
  kernlContext: KERNLContext,
  devProtocols: DevProtocols
): SystemBlock[] {
  // ── Stable portion ──────────────────────────────────────────────────────
  const stableParts: string[] = [
    'You are GregLite, a personal cognitive operating system.',
    "You function as COO to the user's CEO role.",
    'Be direct, execution-focused, and intelligence-first.',
    '',
    'IMPORTANT: Respond conversationally to casual messages like greetings, short questions, or chitchat.',
    'Do NOT auto-execute bootstrap sequences, file reads, environment detection, or load any instruction files',
    'unless the user explicitly requests work on a specific project, codebase, or task.',
    "If the user says \"hey\", \"what's up\", or similar, just respond naturally.",
    'When the user DOES request specific work, then engage your full capabilities.',
    '',
  ];

  if (devProtocols.technicalStandards) {
    stableParts.push('=== TECHNICAL STANDARDS ===');
    stableParts.push(devProtocols.technicalStandards);
    stableParts.push('');
  }

  if (devProtocols.claudeInstructions) {
    stableParts.push('=== OPERATING INSTRUCTIONS ===');
    stableParts.push(devProtocols.claudeInstructions);
    stableParts.push('');
  }

  const stableBlock: SystemBlock = {
    type: 'text',
    text: stableParts.join('\n'),
    cache_control: { type: 'ephemeral' },
  };

  // ── Dynamic portion (KERNL context) ────────────────────────────────────
  const dynamicParts: string[] = [];

  if (kernlContext.lastSessionSummary) {
    dynamicParts.push('=== LAST SESSION ===');
    dynamicParts.push(kernlContext.lastSessionSummary);
    dynamicParts.push('');
  }

  if (kernlContext.recentDecisions.length > 0) {
    dynamicParts.push('=== RECENT DECISIONS ===');
    kernlContext.recentDecisions.forEach((d) => {
      dynamicParts.push(`- [${d.category}] ${d.decision} (${new Date(d.timestamp).toLocaleDateString()})`);
    });
    dynamicParts.push('');
  }

  if (kernlContext.activeProjects.length > 0) {
    dynamicParts.push('=== ACTIVE PROJECTS ===');
    kernlContext.activeProjects.forEach((p) => {
      dynamicParts.push(`- ${p.name}${p.path ? ` (${p.path})` : ''}`);
    });
    dynamicParts.push('');
  }

  const blocks: SystemBlock[] = [stableBlock];
  if (dynamicParts.length > 0) {
    blocks.push({ type: 'text', text: dynamicParts.join('\n') });
  }
  return blocks;
}

export { DEFAULT_SYSTEM_PROMPT };
