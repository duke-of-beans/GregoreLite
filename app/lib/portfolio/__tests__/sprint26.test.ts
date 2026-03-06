/**
 * Sprint 26.0 Unit Tests
 *
 * Covers: scaffold templates, type inference, attention analyzer
 * (staleness, blockers, test failures, deadline, mute override),
 * and attention queue sorting/limits.
 */

import { describe, it, expect, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    mkdirSync:  vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
  },
  existsSync:    vi.fn(() => false),
  mkdirSync:     vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync:  vi.fn(() => ''),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
  exec:     vi.fn(),
}));

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({
      run:  vi.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
      get:  vi.fn(() => null),
      all:  vi.fn(() => []),
    })),
  })),
}));

vi.mock('@/lib/portfolio/scanner', () => ({
  scanSingleProject: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import * as fsMod from 'fs';
// scaffold.ts uses `import fs from 'fs'` (default import) — cast for mock access
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fsDefault = (fsMod as any).default as typeof fsMod;
import { getScaffoldTemplate, scaffoldProject } from '../scaffold';
import { inferTypeFromDescription, getNewProjectQuestions } from '../onboarding';
import { analyzeAttention } from '../analyzer';
import type { ProjectCard } from '@/lib/portfolio/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function makeCard(overrides: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id:           overrides.id            ?? 'proj-1',
    name:         overrides.name          ?? 'Test Project',
    path:         overrides.path          ?? '/projects/test',
    type:         overrides.type          ?? 'code',
    typeLabel:    overrides.typeLabel      ?? 'Code',
    status:       overrides.status        ?? 'active',
    version:      overrides.version       ?? null,
    phase:        overrides.phase         ?? null,
    lastActivity: overrides.lastActivity  ?? daysAgo(1),
    health:       overrides.health        ?? 'green',
    healthReason: overrides.healthReason  ?? 'On track',
    nextAction:   overrides.nextAction    ?? null,
    customMetrics: overrides.customMetrics ?? {},
    attentionMutedUntil: overrides.attentionMutedUntil ?? null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Scaffold Templates
// ─────────────────────────────────────────────────────────────────────────────

describe('getScaffoldTemplate', () => {
  it('returns a template for every project type', () => {
    const types = ['code', 'research', 'business', 'creative', 'custom'] as const;
    for (const type of types) {
      const t = getScaffoldTemplate(type);
      expect(t.type).toBe(type);
      expect(t.files.length).toBeGreaterThan(0);
    }
  });

  it('each template file has a path', () => {
    const template = getScaffoldTemplate('code');
    for (const f of template.files) {
      expect(typeof f.path).toBe('string');
      expect(f.path.length).toBeGreaterThan(0);
    }
  });

  it('throws for unknown type', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => getScaffoldTemplate('unknown' as any)).toThrow();
  });
});

describe('scaffoldProject — substituteAnswers', () => {
  it('substitutes {{key}} placeholders in string content', () => {
    const template = getScaffoldTemplate('code');
    const answers = {
      projectName:    'MyApp',
      techStack:      'Next.js + TypeScript',
      primaryGoal:    'Ship v1',
      teamSize:       '1',
    };
    // Should not throw — fs is mocked
    const result = scaffoldProject(template, '/tmp/myapp', answers);
    expect(result.success).toBe(true);
    expect(result.filesCreated.length).toBeGreaterThan(0);
  });

  it('skips existing files without overwriting', () => {
    // scaffold.ts uses `import fs from 'fs'` (default import) so mock via default.
    // existsSync call order: [dirPath, parentDir₁, filePath₁, parentDir₂, filePath₂, …]
    vi.mocked(fsDefault.existsSync)
      .mockReturnValueOnce(true)  // dirPath exists — skip top-level mkdir
      .mockReturnValueOnce(true)  // parentDir of file 1 exists
      .mockReturnValueOnce(true); // filePath of file 1 exists → skip write
    const template = getScaffoldTemplate('custom');
    const result = scaffoldProject(template, '/tmp/existing', {});
    // One file was skipped so total created = total files - 1
    expect(result.filesCreated.length).toBe(template.files.length - 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Type Inference
// ─────────────────────────────────────────────────────────────────────────────

describe('inferTypeFromDescription', () => {
  it('identifies code projects', () => {
    const r = inferTypeFromDescription('building a TypeScript API with unit tests');
    expect(r.type).toBe('code');
    expect(r.confidence).not.toBe('low');
  });

  it('identifies research projects', () => {
    const r = inferTypeFromDescription('analysing survey data and writing a literature review');
    expect(r.type).toBe('research');
  });

  it('identifies business projects', () => {
    const r = inferTypeFromDescription('sales pipeline dashboard for revenue tracking');
    expect(r.type).toBe('business');
  });

  it('identifies creative projects', () => {
    const r = inferTypeFromDescription('writing a novel and designing the cover artwork');
    expect(r.type).toBe('creative');
  });

  it('falls back to custom with low confidence for ambiguous descriptions', () => {
    const r = inferTypeFromDescription('misc stuff');
    expect(r.type).toBe('custom');
    expect(r.confidence).toBe('low');
  });

  it('returns high confidence for strong keyword match', () => {
    const r = inferTypeFromDescription(
      'TypeScript React component library with jest tests, CI/CD pipeline, and npm package',
    );
    expect(r.type).toBe('code');
    expect(r.confidence).toBe('high');
  });
});

describe('getNewProjectQuestions', () => {
  it('returns questions for each inferred type', () => {
    const types = ['code', 'research', 'business', 'creative'] as const;
    for (const type of types) {
      const qs = getNewProjectQuestions('desc', { type, confidence: 'high', reason: '' });
      expect(qs.length).toBeGreaterThan(0);
      // OnboardingQuestion uses 'id' and 'question' fields
      expect(qs[0]).toHaveProperty('id');
      expect(qs[0]).toHaveProperty('question');
    }
  });

  it('returns core questions for custom / low-confidence', () => {
    const qs = getNewProjectQuestions('misc', { type: 'custom', confidence: 'low', reason: '' });
    expect(qs.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Attention Analyzer
// ─────────────────────────────────────────────────────────────────────────────

describe('analyzeAttention — empty / healthy projects', () => {
  it('returns empty array for no projects', () => {
    expect(analyzeAttention([])).toEqual([]);
  });

  it('returns empty array when all projects are healthy and recent', () => {
    const cards = [
      makeCard({ type: 'code',     lastActivity: daysAgo(1) }),
      makeCard({ type: 'research', lastActivity: daysAgo(3), id: 'p2' }),
    ];
    expect(analyzeAttention(cards)).toHaveLength(0);
  });
});

describe('analyzeAttention — staleness', () => {
  it('flags code projects red after 14 days', () => {
    const card = makeCard({ type: 'code', lastActivity: daysAgo(15) });
    const items = analyzeAttention([card]);
    expect(items).toHaveLength(1);
    expect(items[0]!.severity).toBe('high');
    expect(items[0]!.triggerType).toBe('staleness');
  });

  it('flags code projects amber after 7 days', () => {
    const card = makeCard({ type: 'code', lastActivity: daysAgo(8) });
    const items = analyzeAttention([card]);
    expect(items).toHaveLength(1);
    expect(items[0]!.severity).toBe('medium');
  });

  it('uses higher thresholds for research projects', () => {
    // 14 days is amber for research (not red)
    const card = makeCard({ type: 'research', lastActivity: daysAgo(15) });
    const items = analyzeAttention([card]);
    expect(items).toHaveLength(1);
    expect(items[0]!.severity).toBe('medium');
  });

  it('flags research as high only after 30 days', () => {
    const card = makeCard({ type: 'research', lastActivity: daysAgo(31) });
    const items = analyzeAttention([card]);
    const stale = items.find((i) => i.triggerType === 'staleness');
    expect(stale?.severity).toBe('high');
  });

  it('uses tighter thresholds for business projects (amber at 5 days)', () => {
    const card = makeCard({ type: 'business', lastActivity: daysAgo(6) });
    const items = analyzeAttention([card]);
    expect(items).toHaveLength(1);
    expect(items[0]!.severity).toBe('medium');
  });
});

describe('analyzeAttention — blockers', () => {
  it('flags projects whose nextAction contains "blocked"', () => {
    const card = makeCard({ nextAction: 'BLOCKED: waiting on API access' });
    const items = analyzeAttention([card]);
    const item = items.find((i) => i.triggerType === 'blockers');
    expect(item).toBeDefined();
    expect(item?.severity).toBe('high');
  });

  it('flags projects whose phase contains "blocked"', () => {
    const card = makeCard({ phase: 'blocked on review' });
    const items = analyzeAttention([card]);
    expect(items.some((i) => i.triggerType === 'blockers')).toBe(true);
  });
});

describe('analyzeAttention — failing tests', () => {
  it('flags projects with failing tests as high severity', () => {
    // testPassing is a count — 9/10 passing means 1 failing
    const card = makeCard({ testCount: 10, testPassing: 9 });
    const items = analyzeAttention([card]);
    const item = items.find((i) => i.triggerType === 'tests');
    expect(item?.severity).toBe('high');
  });

  it('does not flag projects where all tests are passing', () => {
    // testPassing is a count, not a boolean — 10/10 passing means no failures
    const card = makeCard({ testCount: 10, testPassing: 10 });
    const items = analyzeAttention([card]);
    expect(items.find((i) => i.triggerType === 'tests')).toBeUndefined();
  });
});

describe('analyzeAttention — mute override', () => {
  it('skips muted projects', () => {
    const card = makeCard({
      lastActivity: daysAgo(20), // would normally flag as stale
      attentionMutedUntil: NOW + 3_600_000, // muted for 1 more hour
    });
    expect(analyzeAttention([card])).toHaveLength(0);
  });

  it('does not skip projects whose mute has expired', () => {
    const card = makeCard({
      lastActivity: daysAgo(20),
      attentionMutedUntil: NOW - 1000, // mute expired 1 second ago
    });
    expect(analyzeAttention([card]).length).toBeGreaterThan(0);
  });
});

describe('analyzeAttention — sorting and limits', () => {
  it('sorts high severity before medium before low', () => {
    const cards = [
      makeCard({ id: 'low-1',  lastActivity: daysAgo(8),  type: 'code' }), // amber → medium
      makeCard({ id: 'high-1', lastActivity: daysAgo(20), type: 'code' }), // red → high
      makeCard({ id: 'low-2',  lastActivity: null,        type: 'code' }), // never active → low
    ];
    const items = analyzeAttention(cards);
    const severities = items.map((i) => i.severity);
    const highIdx   = severities.indexOf('high');
    const mediumIdx = severities.indexOf('medium');
    const lowIdx    = severities.indexOf('low');
    if (highIdx !== -1 && mediumIdx !== -1) expect(highIdx).toBeLessThan(mediumIdx);
    if (mediumIdx !== -1 && lowIdx !== -1) expect(mediumIdx).toBeLessThan(lowIdx);
  });

  it('caps results at 10 items', () => {
    // Generate 15 stale code projects
    const cards = Array.from({ length: 15 }, (_, i) =>
      makeCard({ id: `p${i}`, lastActivity: daysAgo(20) }),
    );
    expect(analyzeAttention(cards).length).toBeLessThanOrEqual(10);
  });

  it('includes projectId and projectName on each item', () => {
    const card = makeCard({ id: 'myid', name: 'My Project', lastActivity: daysAgo(20) });
    const items = analyzeAttention([card]);
    expect(items[0]?.projectId).toBe('myid');
    expect(items[0]?.projectName).toBe('My Project');
  });
});
