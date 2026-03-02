/**
 * EoS Batch Processor — TypeScript port of BatchProcessor.js
 *
 * Processes an array of items in parallel batches. No external deps.
 * Errors in individual items are captured and returned — they do not
 * abort the batch.
 */

export interface BatchResult<T> {
  results: T[];
  errors: Array<{ item: string; error: string }>;
}

export interface BatchOptions {
  /** How many items to process in each parallel wave. Default: 10 */
  batchSize?: number;
}

/**
 * Process `items` through `processor` in waves of `batchSize` parallel calls.
 *
 * @param items     Array of file paths (or any string keys)
 * @param processor Async function that takes a single item and returns T
 * @param options   BatchOptions
 */
export async function processBatch<T>(
  items: string[],
  processor: (item: string) => Promise<T>,
  options: BatchOptions = {},
): Promise<BatchResult<T>> {
  const batchSize = options.batchSize ?? 10;
  const results: T[] = [];
  const errors: Array<{ item: string; error: string }> = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map((item) => processor(item)));

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j]!;
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        errors.push({
          item: batch[j]!,
          error:
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason),
        });
      }
    }
  }

  return { results, errors };
}
