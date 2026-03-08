/**
 * @xenova/transformers no-op shim for the sidecar.
 *
 * Embeddings are fire-and-forget in all route handlers — calls are wrapped
 * in .catch() so failures degrade gracefully. The sidecar skips model
 * downloads; Ghost suggestions and semantic search are offline-only features
 * that require the full desktop environment.
 */

export const pipeline = async (_task: string, _model: string): Promise<() => never> => {
  throw new Error('@xenova/transformers: not available in sidecar mode — embeddings disabled');
};

export const env = {
  cacheDir: '',
  localModelPath: '',
  allowRemoteModels: false,
  allowLocalModels: false,
};

export const AutoTokenizer = {
  from_pretrained: async (_model: string): Promise<never> => {
    throw new Error('@xenova/transformers: not available in sidecar mode');
  },
};

export const AutoModel = {
  from_pretrained: async (_model: string): Promise<never> => {
    throw new Error('@xenova/transformers: not available in sidecar mode');
  },
};
