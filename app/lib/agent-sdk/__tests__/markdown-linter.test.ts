/**
 * markdown-linter.test.ts — Sprint 11.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMarkdownLinter } from '../tools/markdown-linter';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

import fs from 'fs';

const mockExistsSync  = vi.mocked(fs.existsSync);
const mockStatSync    = vi.mocked(fs.statSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

const CLEAN_MD = `# Title

Some content here.

## Section

- item one
- item two
`;

const ISSUES_MD = `## Missing H1

* star marker
- dash marker

Line with trailing space   
## No blank before this header
`;

describe('runMarkdownLinter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty violations for a clean markdown file', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true } as ReturnType<typeof fs.statSync>);
    mockReadFileSync.mockReturnValue(CLEAN_MD);

    const result = runMarkdownLinter('/docs/clean.md');

    expect(result.fileCount).toBe(1);
    expect(result.violations).toHaveLength(0);
  });

  it('detects no-missing-h1 when file has no H1', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true } as ReturnType<typeof fs.statSync>);
    mockReadFileSync.mockReturnValue(ISSUES_MD);

    const result = runMarkdownLinter('/docs/issues.md');

    const h1Violation = result.violations.find((v) => v.rule === 'no-missing-h1');
    expect(h1Violation).toBeDefined();
    expect(h1Violation?.line).toBe(1);
  });

  it('detects consistent-list-markers when * and - are mixed', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true } as ReturnType<typeof fs.statSync>);
    mockReadFileSync.mockReturnValue(ISSUES_MD);

    const result = runMarkdownLinter('/docs/issues.md');

    const mixViolation = result.violations.find((v) => v.rule === 'consistent-list-markers');
    expect(mixViolation).toBeDefined();
  });

  it('detects no-trailing-whitespace', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true } as ReturnType<typeof fs.statSync>);
    mockReadFileSync.mockReturnValue(ISSUES_MD);

    const result = runMarkdownLinter('/docs/issues.md');

    const wsViolation = result.violations.find((v) => v.rule === 'no-trailing-whitespace');
    expect(wsViolation).toBeDefined();
  });

  it('detects blank-before-header when header immediately follows text', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true } as ReturnType<typeof fs.statSync>);
    mockReadFileSync.mockReturnValue(ISSUES_MD);

    const result = runMarkdownLinter('/docs/issues.md');

    const headerViolation = result.violations.find((v) => v.rule === 'blank-before-header');
    expect(headerViolation).toBeDefined();
  });

  it('returns fileCount=0 for nonexistent path', () => {
    mockExistsSync.mockReturnValue(false);

    const result = runMarkdownLinter('/does/not/exist');

    expect(result.fileCount).toBe(0);
    expect(result.violations).toHaveLength(0);
  });
});
