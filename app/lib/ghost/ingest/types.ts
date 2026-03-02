/**
 * Ghost Ingest — Type Definitions
 *
 * IngestItem   — queued work unit (file or email)
 * ChunkResult  — one chunk with its computed embedding
 * IngestStats  — live pipeline stats for the context panel
 */

import type { EmailMessage } from '@/lib/ghost/email/types';

// ─── Ingest item (queued work unit) ──────────────────────────────────────────

export type IngestItemKind = 'file' | 'email';

export interface FileIngestItem {
  kind: 'file';
  /** Absolute path to the file being indexed */
  path: string;
  /** File extension, lower-case with dot (e.g. '.ts', '.pdf') */
  ext: string;
  /** Watch root — the directory root being monitored */
  watchRoot: string;
  enqueuedAt: number;
}

export interface EmailIngestItem {
  kind: 'email';
  message: EmailMessage;
  provider: 'gmail' | 'outlook';
  account: string;
  enqueuedAt: number;
}

export type IngestItem = FileIngestItem | EmailIngestItem;

// ─── Chunk result ─────────────────────────────────────────────────────────────

export interface ChunkResult {
  /** Unique chunk ID (nanoid) — joins content_chunks and vec_index */
  chunkId: string;
  /** Raw text of this chunk */
  content: string;
  /** 0-based index within the source document */
  chunkIndex: number;
  /** Computed embedding from bge-small-en-v1.5 */
  embedding: Float32Array;
  /** JSON-serialisable metadata stored in content_chunks.metadata */
  metadata: GhostChunkMetadata;
}

export interface GhostChunkMetadata {
  source: 'ghost';
  source_type: 'file' | 'email';
  /** Absolute file path or email message ID */
  source_path: string;
  /** Watch root (files) or email account address (email) */
  source_account: string;
  indexed_at: number;
  /** File extension without leading dot (e.g. 'ts', 'pdf') — file ingest only */
  file_ext?: string;
  /** Email provider — email ingest only */
  email_provider?: 'gmail' | 'outlook';
  /** Subject line — email ingest only */
  email_subject?: string;
  /** Sender address — email ingest only */
  email_from?: string;
}

// ─── Pipeline stats ───────────────────────────────────────────────────────────

export interface IngestStats {
  /** Total source documents indexed (files + emails) */
  totalIndexed: number;
  filesIndexed: number;
  emailsIndexed: number;
  /** Items currently waiting in the queue */
  queueDepth: number;
  /** Unix epoch ms of the last completed ingest */
  lastIngestAt: number;
  /** Whether the ONNX embedding model is loaded and ready */
  embeddingModelReady: boolean;
}
