/**
 * Tests for app/lib/capture/parser.ts — Sprint 29.0
 *
 * Coverage:
 *   - parseCaptureInput(): prefix detection ("Project:", "Project -"), fuzzy matching,
 *     no-prefix passthrough, case insensitivity, partial prefix ≥3 chars
 *   - classifyNote(): question > bug > feature > idea keyword order
 *   - fuzzyMatchProject(): exact, normalized, prefix, no-match
 *
 * Pure functions — no mocking required.
 */

import { describe, it, expect } from 'vitest';
import { parseCaptureInput, classifyNote, fuzzyMatchProject } from '@/lib/capture/parser';

// ── parseCaptureInput ─────────────────────────────────────────────────────────

describe('parseCaptureInput()', () => {
  const PROJECTS = ['GregLite', 'Fine Print', 'HIRM', 'Apex North'];

  it('returns null projectName and full raw text when no prefix is present', () => {
    const result = parseCaptureInput('just a plain thought', PROJECTS);
    expect(result.projectName).toBeNull();
    expect(result.body).toBe('just a plain thought');
  });

  it('parses "Project: body" colon format', () => {
    const result = parseCaptureInput('GregLite: add capture inbox sort', PROJECTS);
    expect(result.projectName).toBe('GregLite');
    expect(result.body).toBe('add capture inbox sort');
  });

  it('parses "Project - body" dash format', () => {
    const result = parseCaptureInput('GregLite - fix the dedup threshold', PROJECTS);
    expect(result.projectName).toBe('GregLite');
    expect(result.body).toBe('fix the dedup threshold');
  });

  it('matches case-insensitively', () => {
    const result = parseCaptureInput('greglite: something important', PROJECTS);
    expect(result.projectName).toBe('GregLite');
  });

  it('matches with partial prefix (≥3 chars)', () => {
    const result = parseCaptureInput('greg: this is a thought', PROJECTS);
    expect(result.projectName).toBe('GregLite');
  });

  it('does not match prefix shorter than 3 chars', () => {
    const result = parseCaptureInput('gr: short prefix', PROJECTS);
    expect(result.projectName).toBeNull();
  });

  it('matches multi-word project names (normalized)', () => {
    const result = parseCaptureInput('fine print: add new visualization', PROJECTS);
    expect(result.projectName).toBe('Fine Print');
  });

  it('returns null projectName when prefix does not match any known project', () => {
    const result = parseCaptureInput('UnknownProject: some idea', PROJECTS);
    expect(result.projectName).toBeNull();
    expect(result.body).toBe('UnknownProject: some idea');
  });

  it('handles empty knownProjects array', () => {
    const result = parseCaptureInput('GregLite: something', []);
    expect(result.projectName).toBeNull();
    expect(result.body).toBe('GregLite: something');
  });

  it('trims whitespace from parsed body', () => {
    const result = parseCaptureInput('GregLite:   lots of spaces here   ', PROJECTS);
    expect(result.body).toBe('lots of spaces here');
  });

  it('handles raw text with only whitespace', () => {
    const result = parseCaptureInput('   ', PROJECTS);
    expect(result.projectName).toBeNull();
  });
});

// ── classifyNote ──────────────────────────────────────────────────────────────

describe('classifyNote()', () => {
  it('classifies text with "?" as question (highest priority)', () => {
    expect(classifyNote('Why does this crash?')).toBe('question');
  });

  it('classifies "how to" as question', () => {
    expect(classifyNote('how to implement this feature')).toBe('question');
  });

  it('classifies "why" as question', () => {
    expect(classifyNote('why is the API so slow')).toBe('question');
  });

  it('classifies "bug" keyword as bug', () => {
    expect(classifyNote('there is a bug in the parser')).toBe('bug');
  });

  it('classifies "error" keyword as bug', () => {
    expect(classifyNote('getting an error on submit')).toBe('bug');
  });

  it('classifies "crash" keyword as bug', () => {
    expect(classifyNote('app crashes when opening settings')).toBe('bug');
  });

  it('classifies "broken" keyword as bug', () => {
    expect(classifyNote('the modal is broken')).toBe('bug');
  });

  it('classifies "add" keyword as feature', () => {
    expect(classifyNote('add a dark mode toggle')).toBe('feature');
  });

  it('classifies "implement" keyword as feature', () => {
    expect(classifyNote('implement export to PDF')).toBe('feature');
  });

  it('classifies "build" keyword as feature', () => {
    expect(classifyNote('build the capture inbox view')).toBe('feature');
  });

  it('falls back to "idea" for unrecognized text', () => {
    expect(classifyNote('something interesting happened today')).toBe('idea');
  });

  it('question takes priority over bug keywords', () => {
    expect(classifyNote('is this error expected?')).toBe('question');
  });

  it('bug takes priority over feature keywords', () => {
    expect(classifyNote('bug: add proper error handling')).toBe('bug');
  });

  it('classifies empty string as idea', () => {
    expect(classifyNote('')).toBe('idea');
  });
});

// ── fuzzyMatchProject ─────────────────────────────────────────────────────────

describe('fuzzyMatchProject()', () => {
  const PROJECTS = ['GregLite', 'Fine Print', 'HIRM', 'Apex North'];

  it('returns exact match (case-insensitive)', () => {
    expect(fuzzyMatchProject('greglite', PROJECTS)).toBe('GregLite');
    expect(fuzzyMatchProject('HIRM', PROJECTS)).toBe('HIRM');
  });

  it('returns normalized match (strips spaces/hyphens/underscores)', () => {
    expect(fuzzyMatchProject('fine-print', PROJECTS)).toBe('Fine Print');
    expect(fuzzyMatchProject('fine_print', PROJECTS)).toBe('Fine Print');
    expect(fuzzyMatchProject('fineprint', PROJECTS)).toBe('Fine Print');
  });

  it('returns prefix match for ≥3 char prefix', () => {
    expect(fuzzyMatchProject('greg', PROJECTS)).toBe('GregLite');
    expect(fuzzyMatchProject('apex', PROJECTS)).toBe('Apex North');
  });

  it('returns null for prefix shorter than 3 chars', () => {
    expect(fuzzyMatchProject('gr', PROJECTS)).toBeNull();
  });

  it('returns null when no match found', () => {
    expect(fuzzyMatchProject('completely unknown', PROJECTS)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(fuzzyMatchProject('', PROJECTS)).toBeNull();
  });

  it('returns null when knownProjects is empty', () => {
    expect(fuzzyMatchProject('GregLite', [])).toBeNull();
  });
});
