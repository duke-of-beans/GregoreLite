/**
 * Embeddings — Model Loader
 *
 * Singleton lazy-init for Xenova/bge-small-en-v1.5.
 * First call downloads the quantized ONNX model (~25MB) to disk cache.
 * Subsequent calls reuse the cached model — no network required.
 *
 * Uses dynamic ESM import() so the module can be properly intercepted
 * by vitest mocks in tests, and because @xenova/transformers is ESM-only.
 *
 * Model is locked per §5.1 of BLUEPRINT_FINAL.md.
 * MODEL_ID is stored on every embedding record to enable future migration.
 */

export const MODEL_ID = 'Xenova/bge-small-en-v1.5';
export const MODEL_DIMENSION = 384;

type PipelineFn = (
  text: string,
  opts: { pooling: string; normalize: boolean }
) => Promise<{ data: Float32Array }>;

let embedder: PipelineFn | null = null;

/**
 * Returns the singleton feature-extraction pipeline.
 * Dynamic import deferred to first call so vitest mocks can be registered
 * before the module loads, and to avoid loading the ONNX runtime at startup.
 */
export async function getEmbedder(): Promise<PipelineFn> {
  if (!embedder) {
    // Dynamic import — @xenova/transformers is ESM-only; defer until needed.
    // Sprint 22.0: package re-added (pnpm add @xenova/transformers).
    // Variable indirection prevents both webpack and Turbopack from resolving
    // the module at build time. Magic comments added for belt-and-suspenders.
    const moduleName = '@xenova/transformers';
    const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ moduleName);
    const pipelineFactory = (mod as unknown as { pipeline: (task: string, model: string, opts: { quantized: boolean }) => Promise<PipelineFn> }).pipeline;
    embedder = await pipelineFactory('feature-extraction', MODEL_ID, { quantized: true });
  }
  return embedder;
}

/**
 * Embed a single string. Returns a normalized 384-dim Float32Array.
 * Same input always produces same output (deterministic for quantized model).
 */
export async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getEmbedder();
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return result.data;
}
