/**
 * Ghost Ingest — Type-Aware Chunker
 *
 * chunkFile()   — chunk a file's text by type (code / doc / plain)
 * chunkEmail()  — chunk an email body
 *
 * Token budgets from BLUEPRINT section 6.2:
 *   Code (.ts .tsx .js .py .rs .go .java .sql): ~600 tokens, function-boundary aware, 50-token overlap
 *   Documents/PDFs/DOCX: ~700 tokens, paragraph-aware, 100-token overlap
 *   Plain text (.txt .md .yaml .json): ~600 tokens, 100-token overlap
 *   Email body: full if ≤700 tokens; else prose rules, 100-token overlap
 */

// ─── Token estimation (BPE approximation) ────────────────────────────────────

const CHARS_PER_TOKEN = 4;

function tokensOf(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function charsFor(tokens: number): number {
  return tokens * CHARS_PER_TOKEN;
}

// ─── File type classification ─────────────────────────────────────────────────

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rs', '.go', '.java', '.sql',
  '.c', '.cpp', '.cc', '.h', '.hpp', '.cs', '.rb', '.swift',
]);
const DOC_EXTS = new Set(['.pdf', '.docx', '.doc']);

type FileCategory = 'code' | 'doc' | 'plain';

function classify(ext: string): FileCategory {
  const e = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  if (CODE_EXTS.has(e)) return 'code';
  if (DOC_EXTS.has(e)) return 'doc';
  return 'plain';
}

// ─── Paragraph-aware chunker ──────────────────────────────────────────────────

function paragraphChunks(
  text: string,
  maxTokens: number,
  overlapTokens: number
): string[] {
  const paragraphs = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;

    if (tokensOf(candidate) <= maxTokens) {
      current = candidate;
    } else {
      if (current) chunks.push(current);

      if (tokensOf(para) > maxTokens) {
        // Para exceeds budget — slide through it
        const sub = slidingWindow(para, maxTokens, overlapTokens);
        chunks.push(...sub);
        current = '';
      } else {
        current = para;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

// ─── Generic sliding window chunker ──────────────────────────────────────────

function slidingWindow(
  text: string,
  maxTokens: number,
  overlapTokens: number
): string[] {
  const maxChars = charsFor(maxTokens);
  const overlapChars = charsFor(overlapTokens);
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = end - overlapChars;
  }

  return chunks;
}

// ─── Code chunker (function-boundary aware) ───────────────────────────────────

// Matches top-level function/class/method definition lines across major languages
const FUNCTION_BOUNDARY_RE =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class)\s+\w|^(?:export\s+)?(?:abstract\s+)?class\s+\w|^def\s+\w|^(?:pub\s+)?(?:async\s+)?fn\s+\w|^func\s+\w/;

function codeChunks(
  text: string,
  maxTokens: number = 600,
  overlapTokens: number = 50
): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentLines: string[] = [];
  let currentTokens = 0;

  const flushAndOverlap = (nextLine?: string): void => {
    const chunk = currentLines.join('\n').trim();
    if (chunk) chunks.push(chunk);

    // Build overlap buffer from tail of current chunk
    const overlapLines: string[] = [];
    let overlapCount = 0;
    for (let i = currentLines.length - 1; i >= 0; i--) {
      const l = currentLines[i] ?? '';
      overlapCount += tokensOf(l);
      if (overlapCount > overlapTokens) break;
      overlapLines.unshift(l);
    }

    currentLines = nextLine !== undefined
      ? [...overlapLines, nextLine]
      : [...overlapLines];
    currentTokens = currentLines.reduce((s, l) => s + tokensOf(l), 0);
  };

  for (const line of lines) {
    const lineTokens = tokensOf(line);
    const isBoundary = FUNCTION_BOUNDARY_RE.test(line.trimStart());

    // At a function boundary with existing content: flush if adding would exceed budget
    if (isBoundary && currentLines.length > 0 && currentTokens + lineTokens > maxTokens) {
      flushAndOverlap(line);
      continue;
    }

    currentLines.push(line);
    currentTokens += lineTokens;

    // Hard budget exceeded: flush with overlap
    if (currentTokens >= maxTokens) {
      flushAndOverlap();
    }
  }

  // Flush remaining lines
  const tail = currentLines.join('\n').trim();
  if (tail) chunks.push(tail);

  return chunks.filter((c) => c.length > 0);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Chunk a file's text content by its type.
 * Returns string[] of raw chunk texts (empty chunks are filtered out).
 */
export function chunkFile(content: string, ext: string): string[] {
  const category = classify(ext);
  switch (category) {
    case 'code':
      return codeChunks(content, 600, 50);
    case 'doc':
      return paragraphChunks(content, 700, 100);
    case 'plain':
    default:
      return paragraphChunks(content, 600, 100);
  }
}

/**
 * Chunk an email body.
 * If the full body fits within 700 tokens, return as a single chunk.
 * Otherwise apply paragraph-aware chunking with 100-token overlap.
 */
export function chunkEmail(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  if (tokensOf(trimmed) <= 700) return [trimmed];
  return paragraphChunks(trimmed, 700, 100);
}
