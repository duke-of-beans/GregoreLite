/**
 * Vector — Shared Types
 *
 * VectorSearchResult is the base return type for searchSimilar()
 * and is extended by findSimilarChunks() to include chunk content.
 */

export interface VectorSearchResult {
  chunkId: string;
  distance: number;   // cosine distance — lower = more similar (0 = identical)
  similarity: number; // 1 - distance — higher = more similar (1 = identical)
}
