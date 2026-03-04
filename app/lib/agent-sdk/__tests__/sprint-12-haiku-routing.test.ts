/**
 * sprint-12-haiku-routing.test.ts
 *
 * Sprint 12.0 — Smart Haiku Routing
 *
 * Verifies that classification tasks default to claude-haiku-4-5-20251001 and
 * that strategic chat stays on claude-sonnet-4-5. All tests use static file
 * content assertions — no network calls, no DB mocks required.
 *
 * Tests:
 *   1. auto-title route defaults to Haiku model
 *   2. auto-title route accepts a model override via the request interface
 *   3. Ghost generateSummary function signature defaults to Haiku
 *   4. batch-executor uses BATCH_MODEL = claude-haiku-4-5-20251001
 *   5. chat route.ts uses claude-sonnet-4-5 for strategic chat
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

describe('Sprint 12.0 — Haiku routing: auto-title', () => {
  const src = readSrc('app/api/auto-title/route.ts');

  it('defaults to claude-haiku-4-5-20251001 when no model override is provided', () => {
    // model default in destructuring
    expect(src).toContain("model = 'claude-haiku-4-5-20251001'");
  });

  it('accepts a model field on the AutoTitleRequest interface', () => {
    expect(src).toContain('model?: string');
  });

  it('passes model variable to client.messages.create (not a hardcoded string)', () => {
    // Should use `model,` not `model: 'claude-haiku...'` after Sprint 12.0
    expect(src).toMatch(/model,\s*\n\s*max_tokens/);
  });
});

describe('Sprint 12.0 — Haiku routing: Ghost generateSummary', () => {
  const src = readSrc('lib/ghost/scorer/index.ts');

  it('generateSummary defaults to claude-haiku-4-5-20251001', () => {
    expect(src).toContain("model = 'claude-haiku-4-5-20251001'");
  });

  it('generateSummary accepts a model parameter', () => {
    // Function signature with default param
    expect(src).toMatch(/generateSummary\s*\([^)]*model\s*=/);
  });

  it('passes model variable to anthropic.messages.create', () => {
    // Should use `model,` not hardcoded string in create call
    expect(src).toMatch(/model,\s*\n\s*max_tokens: 100/);
  });
});

describe('Sprint 12.0 — Haiku routing: batch-executor', () => {
  const src = readSrc('lib/agent-sdk/batch-executor.ts');

  it('BATCH_MODEL is set to claude-haiku-4-5-20251001', () => {
    expect(src).toContain("const BATCH_MODEL = 'claude-haiku-4-5-20251001'");
  });

  it('uses BATCH_MODEL in batch create request', () => {
    expect(src).toContain('model,');
    expect(src).toContain('const model = BATCH_MODEL');
  });
});

describe('Sprint 12.0 — Sonnet stays on strategic chat', () => {
  const src = readSrc('app/api/chat/route.ts');

  it('strategic chat route uses claude-sonnet-4-5', () => {
    expect(src).toContain("model: 'claude-sonnet-4-5'");
  });

  it('chat route does NOT hardcode Haiku', () => {
    expect(src).not.toContain("model: 'claude-haiku-4-5-20251001'");
  });
});
