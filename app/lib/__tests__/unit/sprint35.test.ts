/**
 * Sprint 35.0 / EPIC-81 — Adapters: Gemini + Markdown + Index Hardening
 *
 * Coverage:
 *   parseGeminiExport: format detection, role mapping, edge cases
 *   parseMarkdownExport: three parsing modes, raw text fallback, SHA-256 dedup
 *   detectFormat: gemini detection + .md/.txt extension handling
 *   runAdapter: gemini/markdown/text routing + never-throw guarantee
 *   types: ImportFormat union includes 'gemini_export'
 *
 * No DB, vector, or embedding interactions required.
 *
 * @module __tests__/unit/sprint35.test.ts
 */

import { vi, describe, it, expect } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock('@/lib/vector', () => ({
  upsertVector: vi.fn().mockResolvedValue(undefined),
  deleteVector: vi.fn(),
}));

vi.mock('@/lib/embeddings/model', () => ({
  embedText: vi.fn().mockResolvedValue(new Float32Array(384)),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { parseGeminiExport }    from '@/lib/import/adapters/gemini';
import { parseMarkdownExport }  from '@/lib/import/adapters/markdown';
import { detectFormat, runAdapter } from '@/lib/import/adapters';
import type { ImportFormat }    from '@/lib/import/types';

// ── Gemini adapter ────────────────────────────────────────────────────────────

describe('parseGeminiExport', () => {
  const sampleExport = [
    {
      title: 'My Gemini Chat',
      conversations: [
        {
          id: 'gemini-conv-1',
          createTime: '2024-06-01T10:00:00Z',
          messages: [
            { author: 'user',  content: 'What is the capital of France?' },
            { author: 'model', content: 'Paris is the capital of France.' },
          ],
        },
      ],
    },
  ];

  it('parses a valid Gemini Takeout array', () => {
    const result = parseGeminiExport(sampleExport);
    expect(result).toHaveLength(1);
    expect(result[0]!.external_id).toBe('gemini-conv-1');
    expect(result[0]!.title).toBe('My Gemini Chat');
  });

  it('sets source_platform to "gemini"', () => {
    const result = parseGeminiExport(sampleExport);
    expect(result[0]!.source_platform).toBe('gemini');
  });

  it('maps author "model" → role "assistant"', () => {
    const result = parseGeminiExport(sampleExport);
    const msgs = result[0]!.messages;
    const modelMsg = msgs.find((m) => m.content.includes('Paris'));
    expect(modelMsg!.role).toBe('assistant');
  });

  it('maps author "user" → role "user"', () => {
    const result = parseGeminiExport(sampleExport);
    const msgs = result[0]!.messages;
    const userMsg = msgs.find((m) => m.content.includes('capital'));
    expect(userMsg!.role).toBe('user');
  });

  it('accepts author "assistant" (normalised alias)', () => {
    const input = [{
      title: 'T',
      conversations: [{
        id: 'c1',
        createTime: 0,
        messages: [{ author: 'assistant', content: 'Hello' }],
      }],
    }];
    const result = parseGeminiExport(input);
    expect(result[0]!.messages[0]!.role).toBe('assistant');
  });

  it('skips messages with unknown roles', () => {
    const input = [{
      title: 'T',
      conversations: [{
        id: 'c1',
        createTime: 0,
        messages: [
          { author: 'system', content: 'Sys message' },
          { author: 'user',   content: 'Kept message' },
        ],
      }],
    }];
    const result = parseGeminiExport(input);
    expect(result[0]!.messages).toHaveLength(1);
    expect(result[0]!.messages[0]!.content).toBe('Kept message');
  });

  it('handles numeric seconds-based createTime', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const input = [{
      title: 'T',
      conversations: [{
        id: 'c1',
        createTime: nowSec,
        messages: [{ author: 'user', content: 'Hi' }],
      }],
    }];
    const result = parseGeminiExport(input);
    // Normalised to ms — should be within 5 seconds of now
    expect(result[0]!.created_at).toBeGreaterThan(nowSec * 1000 - 5000);
    expect(result[0]!.created_at).toBeLessThan(nowSec * 1000 + 5000);
  });

  it('returns [] for empty array input', () => {
    expect(parseGeminiExport([])).toEqual([]);
  });

  it('returns [] for non-array input', () => {
    expect(parseGeminiExport({})).toEqual([]);
    expect(parseGeminiExport(null)).toEqual([]);
  });

  it('returns [] for array without conversations key', () => {
    expect(parseGeminiExport([{ title: 'no-convos', other: 'field' }])).toEqual([]);
  });

  it('skips individual conversations with no valid messages', () => {
    const input = [{
      title: 'T',
      conversations: [
        { id: 'c1', createTime: 0, messages: [] },
        {
          id: 'c2',
          createTime: 0,
          messages: [{ author: 'user', content: 'Valid' }],
        },
      ],
    }];
    const result = parseGeminiExport(input);
    // Only c2 survives (c1 has no messages)
    expect(result).toHaveLength(1);
    expect(result[0]!.external_id).toBe('c2');
  });

  it('parses JSON string input', () => {
    const json = JSON.stringify(sampleExport);
    const result = parseGeminiExport(json);
    expect(result).toHaveLength(1);
  });

  it('returns [] for invalid JSON string', () => {
    expect(parseGeminiExport('not json {')).toEqual([]);
  });
});

// ── Markdown adapter ──────────────────────────────────────────────────────────

describe('parseMarkdownExport', () => {
  it('returns [] for empty input', () => {
    expect(parseMarkdownExport('')).toEqual([]);
    expect(parseMarkdownExport('   \n  ')).toEqual([]);
  });

  it('returns [] for non-string input', () => {
    expect(parseMarkdownExport(null)).toEqual([]);
    expect(parseMarkdownExport(42)).toEqual([]);
  });

  it('parses role-structured format (You: / Claude:)', () => {
    const text = 'You: What time is it?\nClaude: It is noon.';
    const result = parseMarkdownExport(text);
    expect(result).toHaveLength(1);
    const msgs = result[0]!.messages;
    expect(msgs[0]!.role).toBe('user');
    expect(msgs[0]!.content).toBe('What time is it?');
    expect(msgs[1]!.role).toBe('assistant');
    expect(msgs[1]!.content).toBe('It is noon.');
  });

  it('parses role-structured format (User: / Assistant:)', () => {
    const text = 'User: Hello\nAssistant: Hi there';
    const result = parseMarkdownExport(text);
    const msgs = result[0]!.messages;
    expect(msgs[0]!.role).toBe('user');
    expect(msgs[1]!.role).toBe('assistant');
  });

  it('parses markdown header format (## You / ## Claude)', () => {
    const text = '## You\nWhat is 2+2?\n## Claude\nIt is 4.';
    const result = parseMarkdownExport(text);
    expect(result).toHaveLength(1);
    const msgs = result[0]!.messages;
    expect(msgs[0]!.role).toBe('user');
    expect(msgs[0]!.content).toContain('What is 2+2?');
    expect(msgs[1]!.role).toBe('assistant');
    expect(msgs[1]!.content).toContain('It is 4.');
  });

  it('parses markdown header format (## User / ## Assistant)', () => {
    const text = '## User\nHello\n## Assistant\nHi';
    const result = parseMarkdownExport(text);
    const msgs = result[0]!.messages;
    expect(msgs[0]!.role).toBe('user');
    expect(msgs[1]!.role).toBe('assistant');
  });

  it('falls back to raw text for unstructured content', () => {
    const text = 'This is just a note without any role markers at all.';
    const result = parseMarkdownExport(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.messages[0]!.role).toBe('user');
    expect(result[0]!.messages[0]!.content).toBe(text);
  });

  it('produces consistent SHA-256 external_id for identical content', () => {
    const text = 'You: Same\nClaude: Same';
    const r1 = parseMarkdownExport(text);
    const r2 = parseMarkdownExport(text);
    expect(r1[0]!.external_id).toBe(r2[0]!.external_id);
  });

  it('produces different external_id for different content', () => {
    const r1 = parseMarkdownExport('You: Hello\nClaude: Hi');
    const r2 = parseMarkdownExport('You: Bye\nClaude: Goodbye');
    expect(r1[0]!.external_id).not.toBe(r2[0]!.external_id);
  });

  it('sets source_platform to "markdown_import"', () => {
    const result = parseMarkdownExport('You: Test\nClaude: OK');
    expect(result[0]!.source_platform).toBe('markdown_import');
  });

  it('handles multiline messages in role-structured format', () => {
    const text = [
      'You: First line',
      'second line of user message',
      'Claude: Response here',
    ].join('\n');
    const result = parseMarkdownExport(text);
    const userMsg = result[0]!.messages[0]!;
    expect(userMsg.content).toContain('First line');
    expect(userMsg.content).toContain('second line');
  });
});

// ── detectFormat — updated in Sprint 35.0 ────────────────────────────────────

describe('detectFormat (Sprint 35.0 additions)', () => {
  it('detects gemini_export when first item has conversations array', () => {
    const data = [{ title: 'T', conversations: [] }];
    expect(detectFormat('takeout.json', data)).toBe('gemini_export');
  });

  it('prefers claude_ai_export over gemini_export (uuid + chat_messages wins)', () => {
    // claude.ai shape checked before gemini
    const data = [{ uuid: 'x', chat_messages: [] }];
    expect(detectFormat('export.json', data)).toBe('claude_ai_export');
  });

  it('returns "markdown" for .md extension (unchanged)', () => {
    expect(detectFormat('notes.md', null)).toBe('markdown');
  });

  it('returns "text" for .txt extension (unchanged)', () => {
    expect(detectFormat('log.txt', null)).toBe('text');
  });
});

// ── runAdapter — updated in Sprint 35.0 ──────────────────────────────────────

describe('runAdapter (Sprint 35.0 additions)', () => {
  it('routes gemini_export to gemini adapter', () => {
    const data = [{
      title: 'T',
      conversations: [{
        id: 'g1',
        createTime: 0,
        messages: [{ author: 'user', content: 'Hi Gemini' }],
      }],
    }];
    const result = runAdapter('gemini_export', data);
    expect(result).toHaveLength(1);
    expect(result[0]!.source_platform).toBe('gemini');
  });

  it('routes markdown format to markdown adapter', () => {
    const result = runAdapter('markdown', 'You: Hello\nClaude: Hi');
    expect(result).toHaveLength(1);
    expect(result[0]!.source_platform).toBe('markdown_import');
  });

  it('routes text format to markdown adapter', () => {
    const result = runAdapter('text', 'Just some plain text content here.');
    expect(result).toHaveLength(1);
    expect(result[0]!.source_platform).toBe('markdown_import');
  });

  it('does not throw for corrupt gemini input', () => {
    expect(() => runAdapter('gemini_export', 'corrupted string {{ bad json')).not.toThrow();
  });

  it('does not throw for corrupt markdown input', () => {
    expect(() => runAdapter('markdown', null)).not.toThrow();
  });

  it('returns [] for corrupt input (never throws)', () => {
    expect(runAdapter('gemini_export', undefined)).toEqual([]);
  });
});

// ── ImportFormat type completeness ───────────────────────────────────────────

describe('ImportFormat union includes gemini_export', () => {
  it('accepts "gemini_export" as a valid ImportFormat literal', () => {
    // Compile-time check via assignment — if TS compiles, the type includes it
    const fmt: ImportFormat = 'gemini_export';
    expect(fmt).toBe('gemini_export');
  });

  it('all expected formats are representable', () => {
    const formats: ImportFormat[] = [
      'claude_ai_export',
      'chatgpt_export',
      'gemini_export',
      'generic_json',
      'markdown',
      'text',
    ];
    expect(formats).toHaveLength(6);
  });
});
