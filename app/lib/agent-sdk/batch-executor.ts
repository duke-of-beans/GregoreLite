/**
 * batch-executor.ts — Sprint 12.0 (API Cost Optimization)
 *
 * Routes Agent SDK sessions through Anthropic's Message Batches API for
 * a 50% cost reduction. Trade-off: async delivery (no real-time streaming).
 * Appropriate for non-interactive, non-real-time jobs only.
 *
 * Flow:
 *   1. Insert manifest → transition to RUNNING
 *   2. Create Anthropic batch (single request, custom_id = manifestId)
 *   3. Poll every 30s until processing_status === 'ended'
 *   4. Extract result → build ResultReport → transition to COMPLETED/FAILED
 *   5. Fire onComplete / onError callbacks
 *
 * Wired from index.ts: if manifest.protocol.batch === true, route here
 * instead of runQuerySession().
 *
 * BLUEPRINT §4.3 + Sprint 12.0 spec
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './prompt-builder';
import { insertManifest, transitionState, writeResultReport } from './job-tracker';
import { createSessionCost, updateSessionCost, finalizeSessionCost } from './cost-tracker';
import { calculateCost } from './cost-calculator';
import type { TaskManifest, ResultReport } from './types';
import type { QueryCallbacks } from './query';

const client = new Anthropic();

const BATCH_MODEL = 'claude-haiku-4-5-20251001';
const POLL_INTERVAL_MS = 30_000; // 30 seconds

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run an Agent SDK session via Anthropic's Batch API.
 * Resolves when the job reaches a terminal state (completed, failed, interrupted).
 */
export async function runBatchSession(
  manifest: TaskManifest,
  abortSignal: AbortSignal,
  callbacks: QueryCallbacks,
): Promise<void> {
  const manifestId = manifest.manifest_id;
  const model = BATCH_MODEL;

  // ── Guard: already aborted before we start ──────────────────────────────
  if (abortSignal.aborted) {
    callbacks.onComplete(manifestId, 'interrupted');
    return;
  }

  // ── 1. Persist manifest + transition to RUNNING ─────────────────────────
  try {
    insertManifest(manifest);
  } catch {
    // Already inserted (idempotent guard) — continue
  }
  transitionState(manifestId, 'RUNNING');
  callbacks.onStatusChange(manifestId, 'running');

  createSessionCost(manifestId, model, manifest.task.type, null);

  // ── 2. Build prompt content ──────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(manifest);
  const taskPrompt =
    `Execute the following task and respond with a structured result.\n\n` +
    `Task: ${manifest.task.title}\n\n` +
    `Description: ${manifest.task.description}\n\n` +
    `Success criteria:\n${manifest.task.success_criteria.map((c) => `- ${c}`).join('\n')}`;

  // ── 3. Create batch ──────────────────────────────────────────────────────
  let batchId: string;
  try {
    const batch = await client.messages.batches.create({
      requests: [
        {
          custom_id: manifestId,
          params: {
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: taskPrompt }],
          },
        },
      ],
    });
    batchId = batch.id;
  } catch (err) {
    finalizeSessionCost(manifestId);
    transitionState(manifestId, 'FAILED');
    callbacks.onError(manifestId, err instanceof Error ? err : new Error(String(err)));
    return;
  }

  callbacks.onStatusChange(manifestId, 'working');
  callbacks.onLogLine(manifestId, `[batch-executor] Batch created: ${batchId}`);

  // ── 4. Poll until done ───────────────────────────────────────────────────
  const completed = await pollUntilDone(batchId, manifestId, abortSignal, callbacks);

  if (!completed) {
    // Aborted while polling
    finalizeSessionCost(manifestId);
    transitionState(manifestId, 'INTERRUPTED');
    callbacks.onComplete(manifestId, 'interrupted');
    return;
  }

  // ── 5. Extract result ────────────────────────────────────────────────────
  callbacks.onStatusChange(manifestId, 'validating');

  let tokensUsed = 0;
  let costUsd = 0;
  let succeeded = false;

  try {
    const extracted = await extractBatchResult(batchId, manifestId, model);
    tokensUsed = extracted.tokensUsed;
    costUsd = extracted.costUsd;
    succeeded = true;
  } catch (err) {
    finalizeSessionCost(manifestId);
    transitionState(manifestId, 'FAILED');
    callbacks.onError(manifestId, err instanceof Error ? err : new Error(String(err)));
    return;
  }

  // ── 6. Write result report + finalise ───────────────────────────────────
  const now = new Date().toISOString();
  const report: ResultReport = {
    manifest_id: manifestId,
    status: succeeded ? 'success' : 'failure',
    started_at: now,
    completed_at: now,
    duration_seconds: 0, // batch jobs don't have precise duration
    output: {
      files_created: [],
      files_modified: [],
      artifacts: [{ name: 'batch_result', path: '', type: 'text' }],
      logs_path: '',
    },
    quality_results: {},
    tokens_used: tokensUsed,
    cost_usd: costUsd,
    errors: [],
  };

  updateSessionCost(manifestId, tokensUsed, 0, model);
  finalizeSessionCost(manifestId);
  writeResultReport(manifestId, 'COMPLETED', report);
  transitionState(manifestId, 'COMPLETED');

  callbacks.onLogLine(manifestId, `[batch-executor] Done. ${tokensUsed} tokens, $${costUsd.toFixed(4)}`);
  callbacks.onComplete(manifestId, 'completed');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Poll Anthropic until the batch reaches processing_status = 'ended'.
 * Returns true if ended normally, false if aborted.
 */
async function pollUntilDone(
  batchId: string,
  manifestId: string,
  abortSignal: AbortSignal,
  callbacks: QueryCallbacks,
): Promise<boolean> {
  while (true) {
    if (abortSignal.aborted) return false;

    // Wait before polling (first poll also waits — batches take at minimum seconds)
    await new Promise<void>((resolve, reject) => {
      if (abortSignal.aborted) { reject(new Error('aborted')); return; }
      const timer = setTimeout(resolve, POLL_INTERVAL_MS);
      abortSignal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
    }).catch(() => null); // swallow — check aborted below

    if (abortSignal.aborted) return false;

    try {
      const batch = await client.messages.batches.retrieve(batchId);
      callbacks.onLogLine(manifestId, `[batch-executor] Poll: ${batch.processing_status} (${batch.request_counts?.processing ?? '?'} processing)`);

      if (batch.processing_status === 'ended') return true;
    } catch (err) {
      callbacks.onLogLine(manifestId, `[batch-executor] Poll error: ${err instanceof Error ? err.message : String(err)}`);
      // Network hiccup — continue polling
    }
  }
}

/**
 * Iterate batch results and find the entry for our manifestId.
 * Throws if the result is missing, errored, or expired.
 */
async function extractBatchResult(
  batchId: string,
  manifestId: string,
  model: string,
): Promise<{ content: string; tokensUsed: number; costUsd: number }> {
  for await (const result of await client.messages.batches.results(batchId)) {
    if (result.custom_id !== manifestId) continue;

    if (result.result.type === 'errored') {
      throw new Error(`Batch job errored: ${JSON.stringify(result.result.error)}`);
    }
    if (result.result.type === 'expired') {
      throw new Error('Batch job expired before processing completed');
    }
    if (result.result.type !== 'succeeded') {
      throw new Error(`Unexpected batch result type: ${result.result.type}`);
    }

    const msg = result.result.message;
    const textBlock = msg.content.find((b) => b.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';
    const inputTokens = msg.usage.input_tokens;
    const outputTokens = msg.usage.output_tokens;
    const tokensUsed = inputTokens + outputTokens;
    const costUsd = calculateCost(inputTokens, outputTokens, model);

    return { content, tokensUsed, costUsd };
  }

  throw new Error(`Batch result not found for manifestId: ${manifestId}`);
}
