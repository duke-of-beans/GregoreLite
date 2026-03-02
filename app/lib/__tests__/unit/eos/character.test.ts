import { describe, it, expect } from 'vitest';
import { analyzeCharacters } from '@/lib/eos/character';

describe('analyzeCharacters', () => {
  // ── Invisible chars ────────────────────────────────────────────────────────

  it('detects zero-width space (U+200B)', () => {
    const content = 'const x\u200B = 1;';
    const issues = analyzeCharacters(content, 'test.ts');
    expect(issues.some((i) => i.type === 'INVISIBLE_CHAR')).toBe(true);
    expect(issues.find((i) => i.type === 'INVISIBLE_CHAR')?.severity).toBe('DANGER');
  });

  it('detects BOM character (U+FEFF)', () => {
    const content = '\uFEFFconst x = 1;';
    const issues = analyzeCharacters(content, 'test.ts');
    expect(issues.some((i) => i.type === 'INVISIBLE_CHAR')).toBe(true);
  });

  it('caps invisible char reports at 10 per type', () => {
    const zwsp = '\u200B';
    const content = Array.from({ length: 20 }, (_, i) => `const x${i} ${zwsp}= 1;`).join('\n');
    const issues = analyzeCharacters(content, 'test.ts').filter((i) => i.type === 'INVISIBLE_CHAR');
    expect(issues.length).toBeLessThanOrEqual(10);
  });

  it('returns no issues for clean content', () => {
    const content = 'const x = 1;\nexport default x;\n';
    expect(analyzeCharacters(content, 'test.ts')).toHaveLength(0);
  });

  // ── Homoglyphs ─────────────────────────────────────────────────────────────

  it('detects Cyrillic lookalike in identifier position', () => {
    // U+0441 (Cyrillic с) looks like ASCII c — placed in identifier, not string
    const content = 'const fo\u0441 = 1;';
    const issues = analyzeCharacters(content, 'test.ts');
    expect(issues.some((i) => i.type === 'HOMOGLYPH')).toBe(true);
    expect(issues.find((i) => i.type === 'HOMOGLYPH')?.severity).toBe('APOCALYPSE');
  });

  it('does not flag homoglyphs inside string literals', () => {
    // Cyrillic chars inside a string — legitimate user-facing text
    const content = "const label = '\u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435';";
    const issues = analyzeCharacters(content, 'test.ts');
    expect(issues.filter((i) => i.type === 'HOMOGLYPH')).toHaveLength(0);
  });

  // ── Smart quotes ───────────────────────────────────────────────────────────

  it('detects curly double quotes', () => {
    const content = 'const x = \u201CHello\u201D;';
    const issues = analyzeCharacters(content, 'test.ts');
    expect(issues.some((i) => i.type === 'SMART_QUOTE')).toBe(true);
    expect(issues.find((i) => i.type === 'SMART_QUOTE')?.severity).toBe('WARNING');
  });

  it('detects curly single quotes', () => {
    const content = "const x = \u2018Hello\u2019;";
    const issues = analyzeCharacters(content, 'test.ts');
    expect(issues.some((i) => i.type === 'SMART_QUOTE')).toBe(true);
  });

  // ── Greek semicolon ────────────────────────────────────────────────────────

  it('detects Greek question mark (U+037E) as APOCALYPSE', () => {
    const content = 'const x = 1\u037E';
    const issues = analyzeCharacters(content, 'test.ts');
    expect(issues.some((i) => i.type === 'GREEK_SEMICOLON')).toBe(true);
    expect(issues.find((i) => i.type === 'GREEK_SEMICOLON')?.severity).toBe('APOCALYPSE');
  });

  // ── Mixed indentation ──────────────────────────────────────────────────────

  it('detects mixed tab/space indentation', () => {
    const lines = [
      '  function foo() {',
      '\t  const x = 1;',
      '  }',
      '\treturn x;',
      '\tif (true) {}',
      '\tfor (;;) {}',
    ];
    const issues = analyzeCharacters(lines.join('\n'), 'test.ts');
    expect(issues.some((i) => i.type === 'MIXED_INDENT')).toBe(true);
  });

  it('does not flag purely tab-indented files', () => {
    const content = '\tfunction foo() {\n\t\treturn 1;\n\t}\n';
    const issues = analyzeCharacters(content, 'test.ts').filter((i) => i.type === 'MIXED_INDENT');
    expect(issues).toHaveLength(0);
  });

  it('does not flag purely space-indented files', () => {
    const content = '  function foo() {\n    return 1;\n  }\n';
    const issues = analyzeCharacters(content, 'test.ts').filter((i) => i.type === 'MIXED_INDENT');
    expect(issues).toHaveLength(0);
  });

  it('includes correct 1-based line number', () => {
    const content = 'line1\nconst x\u200B = 1;\nline3';
    const issues = analyzeCharacters(content, 'test.ts').filter((i) => i.type === 'INVISIBLE_CHAR');
    expect(issues[0]?.line).toBe(2);
  });
});
