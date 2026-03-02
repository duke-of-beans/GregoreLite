/**
 * Ghost Ingest — Public API
 *
 * ingestFile()      — queue a file for chunking + embedding + storage
 * ingestEmail()     — queue an email message for chunking + embedding + storage
 * getIngestStats()  — live pipeline stats for the context panel
 * getQueueDepth()   — current backlog count
 * startIngestQueue() / stopIngestQueue() — lifecycle management
 *
 * Processing pipeline per item:
 *   privacy check → read content → chunk (type-aware) → embed (batched)
 *   → write to content_chunks + vec_index → write ghost_indexed_items audit row
 */

import { nanoid } from 'nanoid';
import { chunkFile, chunkEmail } from './chunker';
import { embedBatch, isModelReady } from './embedder';
import { writeChunks, writeAuditRow } from './writer';
import { IngestQueue } from './queue';
import { getDatabase } from '@/lib/kernl/database';
import {
  checkFilePath,
  checkFileContent,
  checkChunk,
  checkEmail as checkEmailPrivacy,
  logExclusion,
} from '@/lib/ghost/privacy';
import type { EmailMessage } from '@/lib/ghost/email/types';
import type {
  IngestItem,
  FileIngestItem,
  EmailIngestItem,
  ChunkResult,
  GhostChunkMetadata,
  IngestStats,
} from './types';

// ─── Singleton queue ──────────────────────────────────────────────────────────

const _queue = new IngestQueue();
_queue.onProcess(processItem);

// ─── Session counters (reset on process restart) ──────────────────────────────

let _filesIndexed = 0;
let _emailsIndexed = 0;
let _lastIngestAt = 0;

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/** Start the ingest queue processor. Safe to call multiple times. */
export function startIngestQueue(): void {
  _queue.start();
}

/** Stop the ingest queue processor. Queued items are retained. */
export function stopIngestQueue(): void {
  _queue.stop();
}

// ─── Public enqueuers ─────────────────────────────────────────────────────────

/**
 * Queue a file for ingest. Returns immediately; processing is async via the queue.
 * @param filePath  Absolute path to the file
 * @param ext       File extension including leading dot (e.g. '.ts')
 * @param watchRoot The monitored directory root (used as source_account in metadata)
 */
export function ingestFile(filePath: string, ext: string, watchRoot: string): void {
  const item: FileIngestItem = {
    kind: 'file',
    path: filePath,
    ext,
    watchRoot,
    enqueuedAt: Date.now(),
  };
  _queue.enqueue(item);
}

/**
 * Queue an email message for ingest. Returns immediately; processing is async.
 */
export function ingestEmail(
  message: EmailMessage,
  provider: 'gmail' | 'outlook',
  account: string
): void {
  const item: EmailIngestItem = {
    kind: 'email',
    message,
    provider,
    account,
    enqueuedAt: Date.now(),
  };
  _queue.enqueue(item);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * Returns live pipeline statistics for the context panel status widget.
 */
export async function getIngestStats(): Promise<IngestStats> {
  const db = getDatabase();
  const row = db
    .prepare('SELECT COUNT(*) AS total FROM ghost_indexed_items WHERE deleted = 0')
    .get() as { total: number } | undefined;

  return {
    totalIndexed: row?.total ?? 0,
    filesIndexed: _filesIndexed,
    emailsIndexed: _emailsIndexed,
    queueDepth: _queue.getDepth(),
    lastIngestAt: _lastIngestAt,
    embeddingModelReady: isModelReady(),
  };
}

/** Returns the current number of items waiting in the ingest queue. */
export function getQueueDepth(): number {
  return _queue.getDepth();
}

// ─── Item processor ───────────────────────────────────────────────────────────

async function processItem(item: IngestItem): Promise<void> {
  if (item.kind === 'file') {
    await processFile(item);
  } else {
    await processEmail(item);
  }
  _lastIngestAt = Date.now();
}

async function processFile(item: FileIngestItem): Promise<void> {
  // Layer 1 + 3 + 4: path-level privacy check (before reading the file)
  const pathCheck = checkFilePath(item.path);
  if (pathCheck.excluded) {
    logExclusion('file', item.path, pathCheck);
    return;
  }

  const fs = await import('fs/promises');
  let content: string;
  try {
    content = await fs.readFile(item.path, 'utf8');
  } catch (err) {
    console.warn(`[GhostIngest] Cannot read file ${item.path}:`, err);
    return;
  }

  // Layer 1 content check (private key headers)
  const contentCheck = checkFileContent(content);
  if (contentCheck.excluded) {
    logExclusion('file', item.path, contentCheck);
    return;
  }

  const rawChunks = chunkFile(content, item.ext);
  if (rawChunks.length === 0) return;

  // Layer 2: PII scan per-chunk — filter out any that contain PII
  const safeChunks: string[] = [];
  for (const chunk of rawChunks) {
    const piiCheck = checkChunk(chunk);
    if (piiCheck.excluded) {
      logExclusion('file', item.path, piiCheck);
    } else {
      safeChunks.push(chunk);
    }
  }
  if (safeChunks.length === 0) return;

  const embeddings = await embedBatch(safeChunks);
  const now = Date.now();
  const chunkResults: ChunkResult[] = safeChunks.map((text, i) => ({
    chunkId: nanoid(),
    content: text,
    chunkIndex: i,
    embedding: embeddings[i]!,
    metadata: {
      source: 'ghost',
      source_type: 'file',
      source_path: item.path,
      source_account: item.watchRoot,
      indexed_at: now,
      file_ext: item.ext.replace(/^\./, ''),
    } satisfies GhostChunkMetadata,
  }));

  await writeChunks(item.path, 'file', chunkResults);
  writeAuditRow({
    id: nanoid(),
    sourceType: 'file',
    sourcePath: item.path,
    sourceAccount: item.watchRoot,
    chunkCount: chunkResults.length,
  });
  _filesIndexed++;
}

async function processEmail(item: EmailIngestItem): Promise<void> {
  const { message, provider, account } = item;

  // Layers 3 + 4: email-level privacy check (subject, sender, domain)
  const emailCheck = checkEmailPrivacy(message);
  if (emailCheck.excluded) {
    logExclusion('email', message.id, emailCheck);
    return;
  }

  const rawChunks = chunkEmail(message.body);
  if (rawChunks.length === 0) return;

  // Layer 2: PII scan per-chunk
  const safeChunks: string[] = [];
  for (const chunk of rawChunks) {
    const piiCheck = checkChunk(chunk);
    if (piiCheck.excluded) {
      logExclusion('email', message.id, piiCheck);
    } else {
      safeChunks.push(chunk);
    }
  }
  if (safeChunks.length === 0) return;

  const embeddings = await embedBatch(safeChunks);
  const now = Date.now();
  const chunkResults: ChunkResult[] = safeChunks.map((text, i) => ({
    chunkId: nanoid(),
    content: text,
    chunkIndex: i,
    embedding: embeddings[i]!,
    metadata: {
      source: 'ghost',
      source_type: 'email',
      source_path: message.id,
      source_account: account,
      indexed_at: now,
      email_provider: provider,
      email_subject: message.subject,
      email_from: message.from,
    } satisfies GhostChunkMetadata,
  }));

  await writeChunks(message.id, 'email', chunkResults);
  writeAuditRow({
    id: nanoid(),
    sourceType: 'email',
    sourcePath: message.id,
    sourceAccount: account,
    chunkCount: chunkResults.length,
  });
  _emailsIndexed++;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { IngestItem, IngestStats, ChunkResult, GhostChunkMetadata } from './types';
