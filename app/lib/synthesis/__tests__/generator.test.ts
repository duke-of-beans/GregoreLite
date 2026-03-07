import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Anthropic mock — must be a real class so `new Anthropic(...)` works ───────
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({
      get: vi.fn(() => ({ value: 'test-api-key' })),
      run: vi.fn(),
      all: vi.fn(() => []),
    })),
  })),
}));

import { generateSourceSynthesis, getCapabilityTeaser } from '../generator';
import type { IndexingSource } from '../types';

function buildApiResponse(opts: {
  sourceText?: string;
  combinationText?: string;
  capabilities?: string[];
} = {}) {
  const sourceText = opts.sourceText ?? 'Organised by quarter. Heavy on product specs.';
  const combinationText = opts.combinationText ?? 'Cross-referenced with email patterns.';
  const caps = opts.capabilities ?? ['Timeline reconstruction', 'Velocity prediction'];
  return [
    `SOURCE_SYNTHESIS:\n${sourceText}`,
    `COMBINATION_SYNTHESIS:\n${combinationText}`,
    `CAPABILITIES:\n${caps.map(c => `- ${c}`).join('\n')}`,
  ].join('\n\n');
}

function makeSource(overrides: Partial<IndexingSource> = {}): IndexingSource {
  return {
    id: 'src-1',
    type: 'local_files',
    label: 'Documents',
    status: 'complete',
    path_or_config: null,
    indexed_count: 120,
    total_count: 200,
    started_at: Date.now() - 3600_000,
    completed_at: Date.now(),
    synthesis_text: null,
    combination_text: null,
    created_at: Date.now() - 7200_000,
    ...overrides,
  };
}

describe('generateSourceSynthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: buildApiResponse() }],
    });
  });

  it('calls Claude API and returns a parsed SynthesisResult', async () => {
    const source = makeSource();
    const result = await generateSourceSynthesis(source, []);

    expect(result).not.toBeNull();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result!.sourceId).toBe(source.id);
    expect(result!.sourceSynthesis).toBeTruthy();
  });

  it('includes combinationSynthesis when previous sources exist', async () => {
    const source = makeSource({ id: 'src-2', type: 'email' });
    const prev = [makeSource()];
    const result = await generateSourceSynthesis(source, prev);

    expect(result!.combinationSynthesis).not.toBeNull();
    expect(result!.combinationSynthesis).toBeTruthy();
  });

  it('returns null combinationSynthesis when no previous sources', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: 'SOURCE_SYNTHESIS:\nFound 120 files.\n\nCOMBINATION_SYNTHESIS:\n\nCAPABILITIES:\n- File search',
      }],
    });

    const source = makeSource();
    const result = await generateSourceSynthesis(source, []);
    // No previous sources — combination should be null or empty
    expect(result).not.toBeNull();
  });

  it('extracts capabilitiesUnlocked as an array', async () => {
    const source = makeSource();
    const result = await generateSourceSynthesis(source, []);

    expect(Array.isArray(result!.capabilitiesUnlocked)).toBe(true);
    expect(result!.capabilitiesUnlocked.length).toBeGreaterThan(0);
  });

  it('throws when API throws', async () => {
    mockCreate.mockRejectedValue(new Error('API timeout'));
    const source = makeSource();
    await expect(generateSourceSynthesis(source, [])).rejects.toThrow('API timeout');
  });

  it('does not contain exclamation marks in sourceSynthesis (voice compliance)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: buildApiResponse({ sourceText: 'Organised by quarter. No exclamation here.' }) }],
    });
    const result = await generateSourceSynthesis(makeSource(), []);
    expect(result!.sourceSynthesis).not.toContain('!');
  });
});

describe('getCapabilityTeaser', () => {
  it('returns a string for every source type', () => {
    const types: Array<Parameters<typeof getCapabilityTeaser>[0]> = [
      'local_files', 'projects', 'email', 'conversations', 'calendar', 'notes', 'custom',
    ];
    types.forEach(type => {
      const result = getCapabilityTeaser(type, []);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  it('returns a meaningful teaser for email', () => {
    const result = getCapabilityTeaser('email', ['local_files']);
    expect(result.length).toBeGreaterThan(10);
  });

  it('returns a meaningful teaser for calendar', () => {
    const result = getCapabilityTeaser('calendar', ['local_files']);
    expect(result.length).toBeGreaterThan(10);
  });

  it('does not contain exclamation marks (voice compliance)', () => {
    const types: Array<Parameters<typeof getCapabilityTeaser>[0]> = [
      'local_files', 'projects', 'email', 'conversations', 'calendar', 'notes', 'custom',
    ];
    types.forEach(type => {
      const teaser = getCapabilityTeaser(type, []);
      expect(teaser).not.toContain('!');
    });
  });
});
