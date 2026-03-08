/**
 * Format Adapter — Markdown / Plain Text Import
 * Sprint 35.0 / EPIC-81
 *
 * Parses .md and .txt files containing conversation dumps.
 * Three detection modes (checked against first 20 lines):
 *   (a) Role-structured  — lines starting with "You: " / "Claude: " / "User: " / "Assistant: "
 *   (b) Markdown headers — "## You" / "## Claude" / "## User" / "## Assistant" blocks
 *   (c) Raw text fallback — no recognizable structure; one message, role='user'
 *
 * external_id: SHA-256 of first 200 chars (deterministic dedup across re-imports)
 * source_platform: 'markdown_import'
 * Never throws — returns [] on bad input.
 */

import { createHash } from 'crypto';
import type { ImportedConversation, ImportedMessage } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_PREFIXES_LC      = ['you: ', 'user: '];
const ASSISTANT_PREFIXES_LC = ['claude: ', 'assistant: '];
const USER_HEADERS_LC       = ['## you', '## user'];
const ASSISTANT_HEADERS_LC  = ['## claude', '## assistant'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256First200(text: string): string {
  return createHash('sha256').update(text.slice(0, 200)).digest('hex');
}

function isRoleStructured(first20: string[]): boolean {
  return first20.some((l) => {
    const lc = l.toLowerCase();
    return (
      USER_PREFIXES_LC.some((p) => lc.startsWith(p)) ||
      ASSISTANT_PREFIXES_LC.some((p) => lc.startsWith(p))
    );
  });
}

function isMarkdownHeaders(first20: string[]): boolean {
  return first20.some((l) => {
    const lc = l.toLowerCase().trim();
    return USER_HEADERS_LC.includes(lc) || ASSISTANT_HEADERS_LC.includes(lc);
  });
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseRoleStructured(text: string, lines: string[]): ImportedConversation {
  const messages: ImportedMessage[] = [];
  let currentRole: 'user' | 'assistant' | null = null;
  let currentContent: string[] = [];

  function flush(): void {
    if (currentRole !== null && currentContent.length > 0) {
      const content = currentContent.join('\n').trim();
      if (content.length > 0) {
        messages.push({ role: currentRole, content, created_at: Date.now() });
      }
    }
    currentContent = [];
  }

  for (const line of lines) {
    const lc = line.toLowerCase();
    const userPrefix = USER_PREFIXES_LC.find((p) => lc.startsWith(p));
    const asstPrefix = ASSISTANT_PREFIXES_LC.find((p) => lc.startsWith(p));

    if (userPrefix) {
      flush();
      currentRole = 'user';
      currentContent = [line.slice(userPrefix.length).trim()];
    } else if (asstPrefix) {
      flush();
      currentRole = 'assistant';
      currentContent = [line.slice(asstPrefix.length).trim()];
    } else if (currentRole !== null) {
      currentContent.push(line);
    }
  }
  flush();

  return {
    external_id: sha256First200(text),
    source_platform: 'markdown_import',
    title: 'Imported Conversation',
    created_at: Date.now(),
    messages,
  };
}

function parseMarkdownHeaders(text: string, lines: string[]): ImportedConversation {
  const messages: ImportedMessage[] = [];
  let currentRole: 'user' | 'assistant' | null = null;
  let currentContent: string[] = [];

  function flush(): void {
    if (currentRole !== null && currentContent.length > 0) {
      const content = currentContent.join('\n').trim();
      if (content.length > 0) {
        messages.push({ role: currentRole, content, created_at: Date.now() });
      }
    }
    currentContent = [];
  }

  for (const line of lines) {
    const lc = line.toLowerCase().trim();
    if (USER_HEADERS_LC.includes(lc)) {
      flush();
      currentRole = 'user';
    } else if (ASSISTANT_HEADERS_LC.includes(lc)) {
      flush();
      currentRole = 'assistant';
    } else if (currentRole !== null) {
      currentContent.push(line);
    }
  }
  flush();

  return {
    external_id: sha256First200(text),
    source_platform: 'markdown_import',
    title: 'Imported Conversation',
    created_at: Date.now(),
    messages,
  };
}

function parseRawText(text: string): ImportedConversation {
  return {
    external_id: sha256First200(text),
    source_platform: 'markdown_import',
    title: 'Imported Text',
    created_at: Date.now(),
    messages: [{ role: 'user', content: text.trim(), created_at: Date.now() }],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseMarkdownExport(content: unknown): ImportedConversation[] {
  const text = typeof content === 'string' ? content : '';
  if (text.trim().length === 0) return [];

  const lines = text.split('\n');
  const first20 = lines.slice(0, 20);

  if (isRoleStructured(first20)) {
    return [parseRoleStructured(text, lines)];
  }
  if (isMarkdownHeaders(first20)) {
    return [parseMarkdownHeaders(text, lines)];
  }
  return [parseRawText(text)];
}
