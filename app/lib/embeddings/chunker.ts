/**
 * Embeddings — Text Chunker
 *
 * 512-token window, 50-token overlap, recursive character splitting.
 * Token count is estimated at 4 chars/token — fast approximation,
 * no tokenizer import overhead (§5.1 blueprint note).
 *
 * Messages under MIN_CHARS (200) are NOT indexed per §5.1.
 */

import type { Chunk } from './types';

const CHUNK_SIZE = 512;       // tokens
const OVERLAP = 50;           // tokens
const CHARS_PER_TOKEN = 4;
export const MIN_CHARS = 200; // exported so index.ts can gate early

const CHUNK_CHARS = CHUNK_SIZE * CHARS_PER_TOKEN;   // 2048
const OVERLAP_CHARS = OVERLAP * CHARS_PER_TOKEN;    // 200

/**
 * Split text into overlapping chunks.
 * Returns empty array for text under MIN_CHARS — caller should skip indexing.
 */
export function chunkText(text: string): Chunk[] {
  if (text.length < MIN_CHARS) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_CHARS, text.length);
    const slice = text.slice(start, end).trim();

    if (slice.length >= MIN_CHARS) {
      chunks.push({
        index,
        text: slice,
        tokenEstimate: Math.ceil(slice.length / CHARS_PER_TOKEN),
      });
      index++;
    }

    start += CHUNK_CHARS - OVERLAP_CHARS;
  }

  return chunks;
}
