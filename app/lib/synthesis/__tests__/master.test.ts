import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Anthropic mock — class so `new Anthropic(...)` works ─────────────────────
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn((sql: string) => ({
      get: vi.fn(() => {
        // Return API key for getClient() call
        if (sql.includes('greg_settings') || sql.includes('api_key')) {
          return { value: 'test-api-key' };
        }
        // Return master synthesis row for loadMasterSynthesis
        if (sql.includes('master_synthesis')) {
          return {
            id: 'ms-1',
            overview: 'A product person who ships.',
            patterns: JSON.stringify(['High output', 'Async-first']),
            insights: JSON.stringify(['Underinvesting in recovery']),
            blind_spots: JSON.stringify(['Meeting overhead underestimated']),
            capability_summary: 'Can predict timeline from velocity data.',
            sources_used: JSON.stringify(['src-1', 'src-2']),
            generated_at: Date.now(),
            status: 'complete',
          };
        }
        return { value: 'test-api-key' };
      }),
      run: vi.fn(),
      all: vi.fn(() => []),
    })),
  })),
}));

import { generateMasterSynthesis, loadMasterSynthesis } from '../master';
import { getDatabase } from '@/lib/kernl/database';
import type { IndexingSource } from '../types';

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
    synthesis_text: 'Organised by quarter. Heavy on product specs.',
    combination_text: null,
    created_at: Date.now() - 7200_000,
    ...overrides,
  };
}

function buildMasterApiResponse(overrides: {
  overview?: string;
  patterns?: string[];
  insights?: string[];
  blindSpots?: string[];
  capabilitySummary?: string;
} = {}) {
  const {
    overview = 'A builder who thinks in systems.',
    patterns = ['Ships in sprints', 'Minimal meetings'],
    insights = ['Energy peaks in the morning'],
    blindSpots = ['Calendar does not reflect priorities'],
    capabilitySummary = 'Predict shipping velocity from past sprints.',
  } = overrides;

  return [
    `OVERVIEW:\n${overview}`,
    `PATTERNS:\n${patterns.map(p => `- ${p}`).join('\n')}`,
    `INSIGHTS:\n${insights.map(i => `- ${i}`).join('\n')}`,
    `BLIND_SPOTS:\n${blindSpots.map(b => `- ${b}`).join('\n')}`,
    `CAPABILITIES:\n${capabilitySummary}`,
  ].join('\n\n');
}

describe('generateMasterSynthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: buildMasterApiResponse() }],
    });
  });

  it('returns a MasterSynthesis with all required fields populated', async () => {
    const sources = [
      makeSource(),
      makeSource({ id: 'src-2', type: 'email', label: 'Email', synthesis_text: 'Mostly async.' }),
    ];
    const result = await generateMasterSynthesis(sources);

    expect(result).not.toBeNull();
    expect(result!.overview).toBeTruthy();
    expect(result!.patterns.length).toBeGreaterThan(0);
    expect(result!.insights.length).toBeGreaterThan(0);
    expect(result!.blind_spots.length).toBeGreaterThan(0);
    expect(result!.capability_summary).toBeTruthy();
  });

  it('parses OVERVIEW section correctly', async () => {
    const result = await generateMasterSynthesis([makeSource()]);
    expect(result!.overview).toBe('A builder who thinks in systems.');
  });

  it('parses PATTERNS as an array, stripping leading dashes', async () => {
    const result = await generateMasterSynthesis([makeSource()]);
    expect(result!.patterns).toEqual(['Ships in sprints', 'Minimal meetings']);
    result!.patterns.forEach(p => expect(p).not.toMatch(/^-/));
  });

  it('parses INSIGHTS as an array', async () => {
    const result = await generateMasterSynthesis([makeSource()]);
    expect(result!.insights).toEqual(['Energy peaks in the morning']);
  });

  it('parses BLIND_SPOTS as an array', async () => {
    const result = await generateMasterSynthesis([makeSource()]);
    expect(result!.blind_spots).toEqual(['Calendar does not reflect priorities']);
  });

  it('parses CAPABILITY_SUMMARY as a string', async () => {
    const result = await generateMasterSynthesis([makeSource()]);
    expect(result!.capability_summary).toBe('Predict shipping velocity from past sprints.');
  });

  it('uses claude-sonnet-4-6 model (quality-critical)', async () => {
    await generateMasterSynthesis([makeSource()]);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' })
    );
  });

  it('overview does not contain exclamation marks (voice compliance)', async () => {
    const result = await generateMasterSynthesis([makeSource()]);
    expect(result!.overview).not.toContain('!');
  });

  it('handles multi-source input and includes source labels in prompt', async () => {
    const sources = [
      makeSource({ type: 'local_files', label: 'Documents' }),
      makeSource({ id: 'src-2', type: 'calendar', label: 'Google Calendar', synthesis_text: 'Meeting-light weeks.' }),
      makeSource({ id: 'src-3', type: 'projects', label: 'Jira', synthesis_text: 'Sprint velocity stable.' }),
    ];
    await generateMasterSynthesis(sources);

    const callArgs = mockCreate.mock.calls[0]![0]! as { system?: string; messages: Array<{ content: string }> };
    const content = (callArgs.system ?? '') + '\n' + callArgs.messages.map(m => m.content).join('\n');
    expect(content).toContain('Documents');
    expect(content).toContain('Google Calendar');
    expect(content).toContain('Jira');
  });

  it('returns a MasterSynthesis with empty overview when API returns empty content', async () => {
    mockCreate.mockResolvedValue({ content: [] });
    const result = await generateMasterSynthesis([makeSource()]);
    expect(result.overview).toBe('');
  });

  it('throws when API throws', async () => {
    mockCreate.mockRejectedValue(new Error('API timeout'));
    await expect(generateMasterSynthesis([makeSource()])).rejects.toThrow('API timeout');
  });
});

describe('loadMasterSynthesis', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parsed MasterSynthesis when a record exists in DB', () => {
    const result = loadMasterSynthesis();
    expect(result).not.toBeNull();
    expect(result!.overview).toBe('A product person who ships.');
    expect(result!.patterns).toEqual(['High output', 'Async-first']);
    expect(result!.capability_summary).toBe('Can predict timeline from velocity data.');
    expect(result!.sources_used).toEqual(['src-1', 'src-2']);
  });

  it('returns null when no master synthesis record exists', () => {
    vi.mocked(getDatabase).mockReturnValueOnce({
      prepare: vi.fn(() => ({ get: vi.fn(() => undefined), run: vi.fn(), all: vi.fn(() => []) })),
    } as unknown as ReturnType<typeof getDatabase>);
    const result = loadMasterSynthesis();
    expect(result).toBeNull();
  });
});
