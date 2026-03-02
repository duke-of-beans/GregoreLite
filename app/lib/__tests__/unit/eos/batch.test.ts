import { describe, it, expect } from 'vitest';
import { processBatch } from '@/lib/eos/batch';

describe('processBatch', () => {
  it('processes all items and returns results', async () => {
    const items = ['a', 'b', 'c'];
    const processor = async (item: string) => item.toUpperCase();
    const { results, errors } = await processBatch(items, processor);
    expect(results).toEqual(['A', 'B', 'C']);
    expect(errors).toHaveLength(0);
  });

  it('captures errors without aborting the batch', async () => {
    const items = ['ok', 'bad', 'ok2'];
    const processor = async (item: string) => {
      if (item === 'bad') throw new Error('boom');
      return item;
    };
    const { results, errors } = await processBatch(items, processor);
    expect(results).toEqual(['ok', 'ok2']);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.item).toBe('bad');
    expect(errors[0]?.error).toBe('boom');
  });

  it('processes in waves of batchSize', async () => {
    const callOrder: string[] = [];
    const items = ['1', '2', '3', '4', '5'];

    const processor = async (item: string) => {
      callOrder.push(item);
      return item;
    };

    await processBatch(items, processor, { batchSize: 2 });
    // All items must be processed
    expect(callOrder).toHaveLength(5);
    expect(new Set(callOrder)).toEqual(new Set(items));
  });

  it('defaults to batchSize 10', async () => {
    const items = Array.from({ length: 25 }, (_, i) => String(i));
    const processor = async (item: string) => Number(item);
    const { results, errors } = await processBatch(items, processor);
    expect(results).toHaveLength(25);
    expect(errors).toHaveLength(0);
  });

  it('handles empty input gracefully', async () => {
    const { results, errors } = await processBatch([], async (x) => x);
    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('captures non-Error rejections as string', async () => {
    const processor = async (_item: string) => { throw 'string error'; };
    const { errors } = await processBatch(['x'], processor);
    expect(errors[0]?.error).toBe('string error');
  });
});
