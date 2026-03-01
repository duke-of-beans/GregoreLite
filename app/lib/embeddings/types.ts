/**
 * Embeddings — Shared Types
 *
 * Chunk and EmbeddingRecord interfaces for the Sprint 3A pipeline.
 * Vectors (Float32Array) live here; persistence to vec_index is Sprint 3B.
 */

export interface Chunk {
  index: number;
  text: string;
  tokenEstimate: number;
}

export interface EmbeddingRecord {
  chunkId: string;        // nanoid
  sourceType: 'conversation' | 'file' | 'email' | 'email_attachment';
  sourceId: string;       // thread_id, file path, email_id
  chunkIndex: number;
  content: string;
  embedding: Float32Array;
  modelId: string;        // always MODEL_ID — required for future migration
  createdAt: number;
}
