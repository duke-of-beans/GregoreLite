/**
 * EoS Character Forensics — TypeScript port
 *
 * Migrated rules (from CharacterForensics.js):
 *   ✅ INVISIBLE_CHAR   — zero-width / control chars (DANGER)
 *   ✅ HOMOGLYPH        — Unicode lookalike characters (APOCALYPSE)
 *   ✅ SMART_QUOTE      — curly quotes in code (WARNING)
 *   ✅ GREEK_SEMICOLON  — U+037E masquerading as semicolon (APOCALYPSE)
 *   ✅ MIXED_INDENT     — tabs and spaces mixed in same file (DANGER)
 *
 * Skipped rules:
 *   ❌ TRAILING_SPACE   — cosmetic, Prettier handles it
 *   ❌ EXCESSIVE_NEWLINES — cosmetic, too noisy
 */

import type { RawIssue } from './types';

// ---------------------------------------------------------------------------
// Character sets
// ---------------------------------------------------------------------------

/** Zero-width / invisible / dangerous control characters */
const INVISIBLE_CHARS: Record<string, string> = {
  '\u200B': 'ZERO WIDTH SPACE',
  '\u200C': 'ZERO WIDTH NON-JOINER',
  '\u200D': 'ZERO WIDTH JOINER',
  '\u200E': 'LEFT-TO-RIGHT MARK',
  '\u200F': 'RIGHT-TO-LEFT MARK',
  '\uFEFF': 'BYTE ORDER MARK / ZERO WIDTH NO-BREAK SPACE',
  '\u00AD': 'SOFT HYPHEN',
  '\u2060': 'WORD JOINER',
  '\u180E': 'MONGOLIAN VOWEL SEPARATOR',
};

/**
 * Homoglyphs: Unicode chars that look like ASCII equivalents.
 * Maps from lookalike → what it looks like.
 */
const HOMOGLYPHS: Record<string, string> = {
  '\u0430': 'a',  // Cyrillic а
  '\u0435': 'e',  // Cyrillic е
  '\u043E': 'o',  // Cyrillic о
  '\u0440': 'p',  // Cyrillic р
  '\u0441': 'c',  // Cyrillic с
  '\u0445': 'x',  // Cyrillic х
  '\u0456': 'i',  // Cyrillic і
  '\u04CF': 'l',  // Cyrillic lowercase el
  '\u0455': 's',  // Cyrillic ѕ
  '\u0461': 'w',  // Cyrillic ѡ
  '\u0391': 'A',  // Greek Alpha
  '\u0392': 'B',  // Greek Beta
  '\u0395': 'E',  // Greek Epsilon
  '\u0396': 'Z',  // Greek Zeta
  '\u0397': 'H',  // Greek Eta
  '\u0399': 'I',  // Greek Iota
  '\u039A': 'K',  // Greek Kappa
  '\u039C': 'M',  // Greek Mu
  '\u039D': 'N',  // Greek Nu
  '\u039F': 'O',  // Greek Omicron
  '\u03A1': 'P',  // Greek Rho
  '\u03A4': 'T',  // Greek Tau
  '\u03A5': 'Y',  // Greek Upsilon
  '\u03A7': 'X',  // Greek Chi
};

/** Curly / smart quote characters */
const SMART_QUOTES = new Set(['\u2018', '\u2019', '\u201C', '\u201D', '\u201A', '\u201E']);

/** Greek question mark (U+037E) — looks identical to ASCII semicolon */
const GREEK_SEMICOLON = '\u037E';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInStringOrComment(line: string, charIndex: number): boolean {
  const before = line.slice(0, charIndex);
  const inLineComment = before.includes('//');
  const inBlockComment = before.includes('/*') && !before.includes('*/');
  const singleQuotes = (before.match(/'/g) ?? []).length % 2;
  const doubleQuotes = (before.match(/"/g) ?? []).length % 2;
  const backticks = (before.match(/`/g) ?? []).length % 2;
  return (
    inLineComment ||
    inBlockComment ||
    singleQuotes === 1 ||
    doubleQuotes === 1 ||
    backticks === 1
  );
}

// ---------------------------------------------------------------------------
// Rule implementations
// ---------------------------------------------------------------------------

function detectInvisibleChars(content: string, filePath: string): RawIssue[] {
  const issues: RawIssue[] = [];
  const lines = content.split('\n');
  const typeSeen = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const [char, name] of Object.entries(INVISIBLE_CHARS)) {
      if (!line.includes(char)) continue;
      const seen = typeSeen.get(char) ?? 0;
      if (seen >= 10) continue;
      typeSeen.set(char, seen + 1);
      issues.push({
        type: 'INVISIBLE_CHAR',
        severity: 'DANGER',
        file: filePath,
        line: i + 1,
        message: `Invisible character detected: ${name} (U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`,
        description: 'Invisible characters can cause subtle bugs and security vulnerabilities.',
        fix: 'Remove the invisible character. Enable "Show whitespace" in your editor.',
      });
    }
  }

  return issues;
}

function detectHomoglyphs(content: string, filePath: string): RawIssue[] {
  const issues: RawIssue[] = [];
  const lines = content.split('\n');
  const typeSeen = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const [char, lookalike] of Object.entries(HOMOGLYPHS)) {
      if (!line.includes(char)) continue;
      // Only flag if NOT inside a string/comment context (allow in copy)
      const idx = line.indexOf(char);
      if (isInStringOrComment(line, idx)) continue;
      const seen = typeSeen.get(char) ?? 0;
      if (seen >= 10) continue;
      typeSeen.set(char, seen + 1);
      issues.push({
        type: 'HOMOGLYPH',
        severity: 'APOCALYPSE',
        file: filePath,
        line: i + 1,
        message: `Homoglyph detected: U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} looks like ASCII '${lookalike}'`,
        description: 'Homoglyph attacks substitute look-alike Unicode chars for ASCII to sneak malicious code past review.',
        fix: `Replace the homoglyph with the real ASCII character '${lookalike}'.`,
      });
    }
  }

  return issues;
}

function detectSmartQuotes(content: string, filePath: string): RawIssue[] {
  const issues: RawIssue[] = [];
  const lines = content.split('\n');
  let seen = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const char of line) {
      if (!SMART_QUOTES.has(char)) continue;
      if (seen >= 10) break;
      seen++;
      issues.push({
        type: 'SMART_QUOTE',
        severity: 'WARNING',
        file: filePath,
        line: i + 1,
        message: `Smart/curly quote in source code: U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`,
        description: 'Smart quotes (curly quotes) in code cause syntax errors. Common when pasting from docs or chat.',
        fix: 'Replace with straight ASCII quotes (\' or ").',
      });
    }
  }

  return issues;
}

function detectGreekSemicolon(content: string, filePath: string): RawIssue[] {
  const issues: RawIssue[] = [];
  const lines = content.split('\n');
  let seen = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.includes(GREEK_SEMICOLON)) continue;
    if (seen >= 10) break;
    seen++;
    issues.push({
      type: 'GREEK_SEMICOLON',
      severity: 'APOCALYPSE',
      file: filePath,
      line: i + 1,
      message: 'Greek question mark (U+037E) masquerading as a semicolon',
      description:
        'U+037E looks identical to ASCII semicolon (U+003B) but is not. ' +
        'Code containing it will fail to parse correctly and is a known injection vector.',
      fix: 'Replace U+037E with the ASCII semicolon (;).',
    });
  }

  return issues;
}

function detectMixedIndent(content: string, filePath: string): RawIssue[] {
  const lines = content.split('\n');
  let tabLines = 0;
  let spaceLines = 0;

  for (const line of lines) {
    if (/^\t/.test(line)) tabLines++;
    else if (/^ /.test(line)) spaceLines++;
  }

  if (tabLines === 0 || spaceLines === 0) return [];

  const ratio = Math.min(tabLines, spaceLines) / Math.max(tabLines, spaceLines);
  if (ratio < 0.05) return []; // Trivial mixing — skip

  return [
    {
      type: 'MIXED_INDENT',
      severity: tabLines > spaceLines ? 'DANGER' : 'WARNING',
      file: filePath,
      message: `Mixed indentation: ${tabLines} tab-indented lines and ${spaceLines} space-indented lines`,
      description: 'Mixed tabs and spaces cause inconsistent rendering and can mask logic errors.',
      fix: 'Standardise on spaces. Run Prettier or your editor\'s "Convert indentation" command.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Public analyser — runs all character rules
// ---------------------------------------------------------------------------

export function analyzeCharacters(content: string, filePath: string): RawIssue[] {
  return [
    ...detectInvisibleChars(content, filePath),
    ...detectHomoglyphs(content, filePath),
    ...detectSmartQuotes(content, filePath),
    ...detectGreekSemicolon(content, filePath),
    ...detectMixedIndent(content, filePath),
  ];
}
