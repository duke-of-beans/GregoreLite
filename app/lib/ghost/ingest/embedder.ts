/**
 * Ghost Ingest — Batch Embedder
 *
 * embedBatch()   — embed texts in batches of 10 with 100ms delay between batches
 * isModelReady() — true once the ONNX runtime has been warmed up
 *
 * Uses the shared Phase 3 bge-small-en-v1.5 model via dynamic import of
 * embedText() from lib/embeddings/model. Dynamic import prevents a circular
 * static dependency and keeps the ONNX runtime lazy until first use.
 *
 * 10-item batches + 100ms inter-batch delay prevent flooding the synchronous
 * ONNX CPU runtime while still achieving reasonable throughput.
 */

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100;

let _modelReady = false;

/**
 * Embed an array of text strings using bge-small-en-v1.5.
 * Processes in batches of 10 with a 100ms pause between batches.
 * Returns Float32Array[] in the same order as the input.
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  // Dynamic import to break circular dep: ghost/ingest → embeddings → vector → embeddings
  const { embedText } = await import('@/lib/embeddings/model');
  _modelReady = true;

  const results: Float32Array[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    for (const text of batch) {
      results.push(await embedText(text));
    }

    // Pause between batches — skip delay after the final batch
    if (i + BATCH_SIZE < texts.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}

/**
 * True once embedText() has been called at least once this session.
 * Used by getIngestStats() to report embedding model readiness.
 */
export function isModelReady(): boolean {
  return _modelReady;
}
