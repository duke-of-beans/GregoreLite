/**
 * Executor
 *
 * Wraps @anthropic-ai/sdk streaming to run a bounded worker session.
 * Maps SDK events to the job state machine and writes transitions to KERNL.
 * Handles abort (kill), cost tracking, and result report assembly.
 *
 * BLUEPRINT §4.3.2 + §4.3.4
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildAgentSystemPrompt } from './manifest';
import {
  insertManifest,
  transitionState,
  updateUsage,
  writeResultReport,
} from './job-tracker';
import { costTracker } from './cost-tracker';
import { AGENT_COST_CONFIG } from './config';
import type { TaskManifest, JobRecord, ResultReport, TokenUsage } from './types';
import { storeShimScoreBefore, logPredictions } from '../shim/improvement-log';

const client = new Anthropic();

// ─── Callbacks the caller wires into the executor ─────────────────────────────

export interface ExecutorCallbacks {
  onStateChange: (jobId: string, state: JobRecord['state']) => void;
  onLogLine: (jobId: string, line: string) => void;
  onUsageUpdate: (jobId: string, tokensUsed: number, costUsd: number) => void;
  onStepIncrement: (jobId: string) => void;
  onComplete: (jobId: string, report: ResultReport) => void;
  onError: (jobId: string, error: Error) => void;
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function runSession(
  manifest: TaskManifest,
  jobRecord: JobRecord,
  callbacks: ExecutorCallbacks
): Promise<void> {
  const jobId = manifest.manifest_id;
  const startedAt = new Date().toISOString();

  // Write initial row to KERNL (SPAWNING already set by spawn() in index.ts)
  insertManifest(manifest);

  // SHIM: store health score snapshot and log pattern predictions (fire-and-forget)
  storeShimScoreBefore(jobId, manifest.context.project_path);
  logPredictions(manifest.context.project_path, manifest.context.files?.length ?? 0);

  // Register with cost tracker — store returned sessionId for all subsequent calls
  const costSessionId = costTracker.startSession(AGENT_COST_CONFIG.defaultModel);

  const filesCreated: string[] = [];
  const filesModified: string[] = [];
  let tokensUsed = 0;
  let costUsd = 0;
  let abortHandler: (() => void) | undefined;

  try {
    // SPAWNING → RUNNING on first text delta
    let hasTransitionedToRunning = false;

    const systemPrompt = buildAgentSystemPrompt(manifest);

    const stream = await client.messages.stream({
      model: AGENT_COST_CONFIG.defaultModel,
      max_tokens: 8096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Begin execution. Project path: ${manifest.context.project_path}. Task: ${manifest.task.title}`,
        },
      ],
    });

    // Honour abort signal from kill()
    abortHandler = () => { stream.controller.abort(); };
    jobRecord.abortController?.signal.addEventListener('abort', abortHandler);

    for await (const event of stream) {
      // Check abort
      if (jobRecord.abortController?.signal.aborted) {
        break;
      }

      switch (event.type) {
        case 'content_block_delta': {
          if (!hasTransitionedToRunning) {
            hasTransitionedToRunning = true;
            transitionState(jobId, 'RUNNING');
            callbacks.onStateChange(jobId, 'RUNNING');
          }

          if (event.delta.type === 'text_delta') {
            const line = event.delta.text;
            callbacks.onLogLine(jobId, line);

            // Heuristic: tool-call markers advance step count
            if (line.includes('tool_use') || line.includes('<tool>')) {
              transitionState(jobId, 'WORKING');
              callbacks.onStateChange(jobId, 'WORKING');
              callbacks.onStepIncrement(jobId);
            }
          }
          break;
        }

        case 'message_delta': {
          if (event.usage) {
            const usage: TokenUsage = {
              inputTokens: 0,
              outputTokens: event.usage.output_tokens ?? 0,
            };
            const state = costTracker.recordUsage(costSessionId, usage);
            tokensUsed = state.inputTokens + state.outputTokens;
            costUsd = state.totalCostUsd;
            updateUsage(jobId, tokensUsed, costUsd);
            callbacks.onUsageUpdate(jobId, tokensUsed, costUsd);
          }
          break;
        }

        case 'message_start': {
          if (event.message.usage) {
            const usage: TokenUsage = {
              inputTokens: event.message.usage.input_tokens ?? 0,
              outputTokens: event.message.usage.output_tokens ?? 0,
            };
            const state = costTracker.recordUsage(costSessionId, usage);
            tokensUsed = state.inputTokens + state.outputTokens;
            costUsd = state.totalCostUsd;
            updateUsage(jobId, tokensUsed, costUsd);
            callbacks.onUsageUpdate(jobId, tokensUsed, costUsd);

            // Warn at soft cap
            if (state.capStatus === 'soft_cap') {
              callbacks.onLogLine(jobId, `[COST CAP] Session cost $${costUsd.toFixed(4)} reached soft cap`);
            }
          }
          break;
        }
      }
    }

    // Final message for token counts
    const finalMessage = await stream.finalMessage();
    const finalUsage: TokenUsage = {
      inputTokens: finalMessage.usage.input_tokens ?? 0,
      outputTokens: finalMessage.usage.output_tokens ?? 0,
    };
    const finalState = costTracker.recordUsage(costSessionId, finalUsage);
    tokensUsed = finalState.inputTokens + finalState.outputTokens;
    costUsd = finalState.totalCostUsd;

    const completedAt = new Date().toISOString();

    if (jobRecord.abortController?.signal.aborted) {
      // INTERRUPTED path — clean up abort listener
      jobRecord.abortController.signal.removeEventListener('abort', abortHandler);

      transitionState(jobId, 'INTERRUPTED');
      callbacks.onStateChange(jobId, 'INTERRUPTED');

      const report = buildReport({
        manifest,
        status: 'partial',
        startedAt,
        completedAt,
        filesCreated,
        filesModified,
        tokensUsed,
        costUsd,
        errors: [{ message: 'Session terminated by user', phase: 'execution' }],
      });
      writeResultReport(jobId, 'INTERRUPTED', report);
      costTracker.endSession(costSessionId);
      callbacks.onComplete(jobId, report);
      return;
    }

    // Clean up abort listener on normal completion
    jobRecord.abortController?.signal.removeEventListener('abort', abortHandler);

    // WORKING → VALIDATING
    transitionState(jobId, 'VALIDATING');
    callbacks.onStateChange(jobId, 'VALIDATING');

    // VALIDATING → COMPLETED
    const report = buildReport({
      manifest,
      status: 'success',
      startedAt,
      completedAt,
      filesCreated,
      filesModified,
      tokensUsed,
      costUsd,
    });

    writeResultReport(jobId, 'COMPLETED', report);
    costTracker.endSession(costSessionId);

    transitionState(jobId, 'COMPLETED');
    callbacks.onStateChange(jobId, 'COMPLETED');
    callbacks.onComplete(jobId, report);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const completedAt = new Date().toISOString();

    // Clean up abort listener on error path
    if (abortHandler) {
      jobRecord.abortController?.signal.removeEventListener('abort', abortHandler);
    }

    transitionState(jobId, 'FAILED');
    callbacks.onStateChange(jobId, 'FAILED');

    const report = buildReport({
      manifest,
      status: 'failure',
      startedAt,
      completedAt,
      filesCreated,
      filesModified,
      tokensUsed,
      costUsd,
      errors: [{ message: error.message, phase: 'execution' }],
    });

    writeResultReport(jobId, 'FAILED', report);
    costTracker.endSession(costSessionId);
    callbacks.onError(jobId, error);
  }
}

// ─── Report builder ───────────────────────────────────────────────────────────

function buildReport(opts: {
  manifest: TaskManifest;
  status: ResultReport['status'];
  startedAt: string;
  completedAt: string;
  filesCreated: string[];
  filesModified: string[];
  tokensUsed: number;
  costUsd: number;
  errors?: ResultReport['errors'];
}): ResultReport {
  const durationMs = new Date(opts.completedAt).getTime() - new Date(opts.startedAt).getTime();
  return {
    manifest_id: opts.manifest.manifest_id,
    status: opts.status,
    started_at: opts.startedAt,
    completed_at: opts.completedAt,
    duration_seconds: Math.round(durationMs / 1000),
    output: {
      files_created: opts.filesCreated,
      files_modified: opts.filesModified,
      artifacts: [],
      logs_path: `.kernl/job-logs/${opts.manifest.manifest_id}.log`,
    },
    quality_results: {},
    tokens_used: opts.tokensUsed,
    cost_usd: opts.costUsd,
    ...(opts.errors !== undefined && { errors: opts.errors }),
  };
}
