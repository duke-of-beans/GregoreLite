/**
 * Adapter Registry — format detection + dispatch
 * Sprint 33.0 / EPIC-81 (hardened Sprint 35.0)
 *
 * detectFormat()  — sniffs filename + content shape → ImportFormat
 * runAdapter()    — dispatches to the correct parser; never throws; returns [] on error
 */

import type { ImportFormat, ImportedConversation } from '../types';
import { parseClaudeAiExport } from './claude-ai';
import { parseChatGptExport } from './chatgpt';
import { parseGeminiExport } from './gemini';
import { parseGenericJson } from './generic-json';
import { parseMarkdownExport } from './markdown';

/**
 * Detect the import format from filename and parsed content.
 * Order matters: more specific checks before generic fallback.
 */
export function detectFormat(filename: string, content: unknown): ImportFormat {
  const lower = filename.toLowerCase();

  // Extension-based detection for text formats
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.txt')) return 'text';

  if (!Array.isArray(content) || content.length === 0) return 'generic_json';

  const first = content[0];
  if (!first || typeof first !== 'object') return 'generic_json';
  const obj = first as Record<string, unknown>;

  // claude.ai export: first item has uuid + chat_messages array
  if (typeof obj['uuid'] === 'string' && Array.isArray(obj['chat_messages'])) {
    console.debug('[import] detectFormat → claude_ai_export');
    return 'claude_ai_export';
  }

  // ChatGPT export: first item has id + mapping (object, not array)
  if (
    typeof obj['id'] === 'string' &&
    obj['mapping'] !== null &&
    typeof obj['mapping'] === 'object' &&
    !Array.isArray(obj['mapping'])
  ) {
    console.debug('[import] detectFormat → chatgpt_export');
    return 'chatgpt_export';
  }

  // Gemini Takeout: first item has a 'conversations' array (not 'chat_messages' / 'mapping')
  if (Array.isArray(obj['conversations'])) {
    console.debug('[import] detectFormat → gemini_export');
    return 'gemini_export';
  }

  console.debug('[import] detectFormat → generic_json');
  return 'generic_json';
}

/**
 * Run the appropriate adapter for the given format.
 * Wraps each adapter in try/catch — returns [] on any error.
 */
export function runAdapter(format: ImportFormat, content: unknown): ImportedConversation[] {
  try {
    console.debug(`[import] runAdapter format=${format}`);
    switch (format) {
      case 'claude_ai_export':
        return parseClaudeAiExport(content);
      case 'chatgpt_export':
        return parseChatGptExport(content);
      case 'gemini_export':
        return parseGeminiExport(content);
      case 'generic_json':
        return parseGenericJson(content);
      case 'markdown':
      case 'text':
        return parseMarkdownExport(content);
      default: {
        const _exhaustive: never = format;
        void _exhaustive;
        return [];
      }
    }
  } catch (err) {
    console.error(`[import] adapter error for format=${format}:`, err);
    return [];
  }
}
