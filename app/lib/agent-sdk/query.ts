/**
 * query.ts — Agent SDK Session Driver — Phase 7A/7B/7C
 *
 * Drives a bounded worker session from start to finish using the Anthropic SDK
 * with tool-use in an agentic loop. Maps SDK events to JobStatus transitions
 * per §4.3.2, checkpoints job_state every 5 tool calls OR 60 seconds.
 *
 * Phase 7B: tools are injected via selectTools() from the permission matrix.
 * Write scope is enforced by checkWriteScope() / scope-enforcer.ts.
 * Sprint 11.1: all 4 previously-stubbed tools are now real implementations.
 *
 * Phase 7C: error-handler.ts wired into the agentic loop.
 * - CONTEXT_LIMIT (max_tokens): FAILED, no retry
 * - IMPOSSIBLE_TASK (end_turn + impossibility phrase + no files): FAILED, no retry
 * - TOOL_ERROR (SDK exception): 3 retries with 1s/2s/4s backoff
 * - NETWORK_ERROR (connection error): 1 retry after 2s
 * Kill-switch and backoff are mutually exclusive (sleepMs respects AbortSignal).
 *
 * BLUEPRINT §4.3.1, §4.3.2, §4.3.3, §4.3.4, §7.10
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

import { buildSystemPrompt } from './prompt-builder';
import { mapEventToStatus } from './event-mapper';
import { SessionLogger, registerLogger, deregisterLogger } from './session-logger';
import { selectTools, isStubTool } from './tool-injector';
import { checkWriteScope, resolveCwd } from './scope-enforcer';
import { classifyStopReason, classifyError, RETRY_CONFIG, FailureMode } from './error-handler';
import { getDatabase } from '../kernl/database';
import { calculateCost } from './cost-calculator';
import { createSessionCost, updateSessionCost, finalizeSessionCost, getSessionCapStatus } from './cost-tracker';
import { AGENT_COST_CONFIG } from './config';
import type { TaskManifest, JobStatus, JobStateRow, StreamEvent, AgentEvent } from './types';
// Sprint 7G: SHIM hybrid integration
import { runShimCheck } from './shim-tool';
// Sprint 7H: self-evolution git tools
import { executeGitCommit, executeGitStatus, executeGitDiff } from './self-evolution/git-tools';
import { getLastScore, recordShimCall, clearSession, SHIM_LOOP_SENTINEL } from './retry-tracker';
import { runPostProcessingShim } from './post-processor';
// Sprint 11.1: real tool implementations replacing stubs
import { runTestRunner } from './tools/test-runner';
import { runShimReadonlyAudit } from './tools/shim-readonly-audit';
import { runMarkdownLinter } from './tools/markdown-linter';
import { runKernlSearch } from './tools/kernl-search';
import { detectShimLoop } from './failure-modes';
// Sprint 19.0: action journal for Law 3 (Reversibility)
import { journalBeforeWrite, journalAfterWrite, journalCommand } from './action-journal';

const client = new Anthropic();

// ─── Checkpoint intervals ─────────────────────────────────────────────────────

const CHECKPOINT_EVERY_N_TOOL_CALLS = 5;
const CHECKPOINT_EVERY_MS = 60_000; // 60 seconds

// ─── Abort-aware sleep (Phase 7C) ─────────────────────────────────────────────
// Used by the SDK retry loop. Rejects immediately if abortSignal fires so the
// kill-switch and backoff delays are mutually exclusive.
function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Session aborted')); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Session aborted during retry delay'));
    }, { once: true });
  });
}

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  manifest: TaskManifest,
  sessionId: string,
): Promise<string> {
  const projectPath = manifest.context.project_path;

  try {
    // Stub tools — not yet implemented (7G/7H)
    if (isStubTool(toolName)) {
      return (
        `NOT_IMPLEMENTED: The "${toolName}" tool is not yet available in this build. ` +
        `It will be implemented in a future sprint. ` +
        `Please use the available filesystem tools to accomplish this task.`
      );
    }

    switch (toolName) {
      case 'fs_read': {
        const rawPath = String(input['path'] ?? '');
        const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(projectPath, rawPath);
        if (!fs.existsSync(filePath)) return `ERROR: File not found: ${filePath}`;
        return fs.readFileSync(filePath, 'utf8');
      }

      case 'fs_write': {
        const rawPath = String(input['path'] ?? '');
        const check = checkWriteScope(rawPath, manifest, false);
        if (!check.allowed) return `ERROR: ${check.errorMessage}`;
        const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(projectPath, rawPath);
        const content = String(input['content'] ?? '');
        // Sprint 19.0: journal before write (Law 3 — Reversibility)
        const jwEntryId = journalBeforeWrite(sessionId, filePath, 'fs_write');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf8');
        journalAfterWrite(jwEntryId, filePath);
        return `OK: Wrote ${content.length} bytes to ${filePath}`;
      }

      case 'fs_write_docs_only': {
        const rawPath = String(input['path'] ?? '');
        const check = checkWriteScope(rawPath, manifest, true);
        if (!check.allowed) return `ERROR: ${check.errorMessage}`;
        const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(projectPath, rawPath);
        const content = String(input['content'] ?? '');
        // Sprint 19.0: journal before write (Law 3 — Reversibility)
        const jwDocsEntryId = journalBeforeWrite(sessionId, filePath, 'fs_write_docs_only');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf8');
        journalAfterWrite(jwDocsEntryId, filePath);
        return `OK: Wrote ${content.length} bytes to ${filePath}`;
      }

      case 'list_directory': {
        const rawPath = String(input['path'] ?? '');
        const dirPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(projectPath, rawPath);
        const recursive = input['recursive'] === true;
        const entries = listDir(dirPath, recursive);
        return JSON.stringify(entries);
      }

      case 'run_command': {
        const command = String(input['command'] ?? '');
        const cwd = input['cwd'] ? String(input['cwd']) : projectPath;
        // Sprint 19.0: journal command (not undoable, but logged for audit — Law 3)
        journalCommand(sessionId, command, 'run_command');
        try {
          const output = execSync(command, {
            cwd,
            timeout: 30_000,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return output.trim() || '(no output)';
        } catch (err) {
          const execErr = err as { stdout?: string; stderr?: string; message?: string };
          return `ERROR: ${execErr.stderr ?? execErr.stdout ?? execErr.message ?? String(err)}`.trim();
        }
      }

      // Sprint 7G: SHIM quality check — local tsc + ESLint + LOC analyser
      case 'shim_check': {
        const rawFilePath = String(input['file_path'] ?? '');
        if (!rawFilePath) return 'ERROR: shim_check requires file_path';
        const filePath = path.isAbsolute(rawFilePath)
          ? rawFilePath
          : path.resolve(projectPath, rawFilePath);

        // Run the local quality analyser
        const shimResult = runShimCheck(filePath, projectPath);

        // Retry tracker: get previous score, record this call
        const manifestId = manifest.manifest_id;
        const scoreBefore = getLastScore(manifestId, filePath) ?? 0;
        const retryStatus = recordShimCall(manifestId, filePath, scoreBefore, shimResult.health_score);

        // SHIM_LOOP: N calls on same file with no improvement → BLOCKED + escalation
        if (retryStatus.triggerLoop) {
          // Write BLOCKED status to job_state
          try {
            const db = getDatabase();
            db.prepare(
              `UPDATE job_state SET status = 'blocked', updated_at = ? WHERE manifest_id = ?`
            ).run(Date.now(), manifestId);

            // Write escalation message to the manifest's strategic thread
            const manifestRow = db.prepare(
              `SELECT strategic_thread_id, title FROM manifests WHERE id = ?`
            ).get(manifestId) as { strategic_thread_id: string; title: string } | undefined;

            if (manifestRow?.strategic_thread_id) {
              const escalationContent =
                `⚠️ SHIM Loop Detected — Agent SDK session "${manifestRow.title ?? manifestId}" ` +
                `has called SHIM on ${path.basename(filePath)} ${retryStatus.callCount} times ` +
                `with no quality improvement (score: ${shimResult.health_score}). ` +
                `Session is blocked. Manual review required.`;

              const escalationMeta = JSON.stringify({
                type: 'shim_loop_escalation',
                manifestId,
                filePath,
                score: shimResult.health_score,
                callCount: retryStatus.callCount,
                actions: [
                  {
                    label: 'Continue Anyway',
                    endpoint: `/api/agent-sdk/jobs/${manifestId}/unblock`,
                    method: 'POST',
                  },
                  {
                    label: 'Kill Session',
                    endpoint: `/api/agent-sdk/jobs/${manifestId}/kill`,
                    method: 'POST',
                  },
                ],
              });

              db.prepare(`
                INSERT INTO messages (id, thread_id, role, content, meta, created_at)
                VALUES (?, ?, 'system', ?, ?, ?)
              `).run(
                randomUUID(),
                manifestRow.strategic_thread_id,
                escalationContent,
                escalationMeta,
                Date.now(),
              );
            }
          } catch {
            // DB escalation failure must not crash the session
          }

          // Return sentinel so query.ts outer loop can detect and report BLOCKED
          return (
            `${SHIM_LOOP_SENTINEL}: SHIM called ${retryStatus.callCount} times on ` +
            `${path.basename(filePath)} with no improvement (score: ${shimResult.health_score}). ` +
            `Session is now BLOCKED. Stop attempting to fix this file. ` +
            `Move on or end the session. David will review via the strategic thread.`
          );
        }

        return JSON.stringify(shimResult);
      }

      // Sprint 7H: git tools for self-evolution sessions
      case 'git_commit': {
        const message = String(input['message'] ?? '');
        if (!message) return 'ERROR: git_commit requires a message';
        const rawFiles = input['files'];
        const files: string[] = Array.isArray(rawFiles)
          ? rawFiles.map((f) => String(f))
          : [];
        if (files.length === 0) return 'ERROR: git_commit requires at least one file';
        // Sprint 19.0: journal git commit (commit hash captured in after_state — Law 3)
        journalCommand(sessionId, `git commit -m "${message}" [files: ${files.join(', ')}]`, 'git_commit');
        return executeGitCommit({ message, files }, projectPath);
      }

      case 'git_status': {
        return executeGitStatus({}, projectPath);
      }

      case 'git_diff': {
        const diffPath = input['path'] ? String(input['path']) : undefined;
        return executeGitDiff(diffPath !== undefined ? { path: diffPath } : {}, projectPath);
      }

      // Sprint 11.1: real tool implementations
      case 'test_runner': {
        const filter = input['filter'] ? String(input['filter']) : undefined;
        const testResult = runTestRunner(projectPath, filter);
        return JSON.stringify(testResult);
      }

      case 'shim_readonly_audit': {
        const rawTarget = String(input['target'] ?? projectPath);
        const auditTarget = path.isAbsolute(rawTarget) ? rawTarget : path.resolve(projectPath, rawTarget);
        const auditResult = await runShimReadonlyAudit(auditTarget);
        return JSON.stringify(auditResult);
      }

      case 'markdown_linter': {
        const rawLintPath = String(input['path'] ?? projectPath);
        const lintTarget = path.isAbsolute(rawLintPath) ? rawLintPath : path.resolve(projectPath, rawLintPath);
        const lintResult = runMarkdownLinter(lintTarget);
        return JSON.stringify(lintResult);
      }

      case 'kernl_search_readonly': {
        const searchQuery = String(input['query'] ?? '');
        const maxResults = typeof input['max_results'] === 'number' ? input['max_results'] : 10;
        const searchResult = runKernlSearch(searchQuery, maxResults);
        return JSON.stringify(searchResult);
      }

      default:
        return `ERROR: Unknown tool: "${toolName}". This tool is not registered in the executor.`;
    }
  } catch (err) {
    return `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function listDir(dirPath: string, recursive: boolean): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries: string[] = [];
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dirPath, item.name);
    entries.push(full);
    if (recursive && item.isDirectory()) {
      entries.push(...listDir(full, true));
    }
  }
  return entries;
}

// ─── job_state helpers ────────────────────────────────────────────────────────

function upsertJobState(row: JobStateRow): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO job_state (
      manifest_id, status, steps_completed, files_modified,
      last_event, log_path, tokens_used_so_far, cost_so_far, updated_at
    ) VALUES (
      @manifest_id, @status, @steps_completed, @files_modified,
      @last_event, @log_path, @tokens_used_so_far, @cost_so_far, @updated_at
    )
    ON CONFLICT(manifest_id) DO UPDATE SET
      status             = excluded.status,
      steps_completed    = excluded.steps_completed,
      files_modified     = excluded.files_modified,
      last_event         = excluded.last_event,
      log_path           = excluded.log_path,
      tokens_used_so_far = excluded.tokens_used_so_far,
      cost_so_far        = excluded.cost_so_far,
      updated_at         = excluded.updated_at
  `).run(row);
}

export function readJobState(manifestId: string): JobStateRow | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM job_state WHERE manifest_id = ?').get(manifestId) as JobStateRow) ?? null;
}

// ─── Main query driver ────────────────────────────────────────────────────────

export interface QueryCallbacks {
  onStatusChange: (manifestId: string, status: JobStatus) => void;
  onStreamEvent: (event: StreamEvent) => void;
  onLogLine: (manifestId: string, line: string) => void;
  onComplete: (manifestId: string, status: JobStatus) => void;
  onError: (manifestId: string, error: Error) => void;
}

export async function runQuerySession(
  manifest: TaskManifest,
  abortSignal: AbortSignal,
  callbacks: QueryCallbacks
): Promise<void> {
  const manifestId  = manifest.manifest_id;
  const projectPath = manifest.context.project_path;
  const sessionType = manifest.task.type;

  // Phase 7B: inject tools from permission matrix; resolve effective CWD
  const injectedTools = selectTools(sessionType, manifest);
  const effectiveCwd  = resolveCwd(sessionType, projectPath, manifestId);

  const logger = new SessionLogger(manifestId);
  registerLogger(manifestId, logger);
  let status: JobStatus = 'spawning';
  let sessionCompletedNormally = false;
  let stepsCompleted = 0;
  let filesModified: string[] = [];
  let tokensUsedSoFar = 0;
  // Sprint 11.1: session-level SHIM call history for detectShimLoop()
  const shimCallHistory: Array<{ file: string; score: number }> = [];
  let costSoFar = 0;
  let toolCallsSinceCheckpoint = 0;
  let lastCheckpointAt = Date.now();
  let inputTokensTotal = 0;
  let outputTokensTotal = 0;

  // Initial job_state row
  upsertJobState({
    manifest_id: manifestId,
    status,
    steps_completed: 0,
    files_modified: '[]',
    last_event: JSON.stringify({ type: 'session_spawned' }),
    log_path: null,
    tokens_used_so_far: 0,
    cost_so_far: 0,
    updated_at: Date.now(),
  });

  callbacks.onStatusChange(manifestId, status);

  // Phase 7D: create session_costs row on spawn
  createSessionCost(
    manifestId,
    AGENT_COST_CONFIG.defaultModel,
    sessionType,
    manifest.context.project_path ?? null,
  );

  const emitAgentEvent = (event: AgentEvent): void => {
    const newStatus = mapEventToStatus(status, event);
    if (newStatus !== status) {
      status = newStatus;
      callbacks.onStatusChange(manifestId, status);
    }

    const streamEvent: StreamEvent = {
      manifestId,
      agentEvent: event,
      jobStatus: status,
      stepsCompleted,
      filesModified: [...filesModified],
      tokensUsedSoFar,
      costSoFar,
      timestamp: Date.now(),
    };
    callbacks.onStreamEvent(streamEvent);
  };

  const shouldCheckpoint = (): boolean => {
    return (
      toolCallsSinceCheckpoint >= CHECKPOINT_EVERY_N_TOOL_CALLS ||
      Date.now() - lastCheckpointAt >= CHECKPOINT_EVERY_MS
    );
  };

  const writeCheckpoint = (): void => {
    upsertJobState({
      manifest_id: manifestId,
      status,
      steps_completed: stepsCompleted,
      files_modified: JSON.stringify(filesModified),
      last_event: JSON.stringify({ type: 'checkpoint', stepsCompleted }),
      log_path: logger.logPath,
      tokens_used_so_far: tokensUsedSoFar,
      cost_so_far: costSoFar,
      updated_at: Date.now(),
    });

    // Phase 7D: persist cost to session_costs on every checkpoint
    updateSessionCost(manifestId, inputTokensTotal, outputTokensTotal, AGENT_COST_CONFIG.defaultModel);

    // Phase 7D: emit soft-cap warning when session cost approaches the configured limit
    const capStatus = getSessionCapStatus(costSoFar);
    if (capStatus === 'warn' || capStatus === 'soft_cap') {
      emitAgentEvent({
        type: 'error_recoverable',
        message: `Session cost approaching limit ($${costSoFar.toFixed(2)})`,
        toolTrace: `cap_status:${capStatus}`,
      });
    }

    toolCallsSinceCheckpoint = 0;
    lastCheckpointAt = Date.now();
  };

  const systemPrompt = buildSystemPrompt(manifest);
  const messages: MessageParam[] = [
    {
      role: 'user',
      content: `Begin execution. Project path: ${projectPath}. Working directory: ${effectiveCwd}. Task: ${manifest.task.title}\n\nDescription: ${manifest.task.description}`,
    },
  ];

  try {
    // Agentic tool-use loop
    let loopCount = 0;
    const MAX_LOOPS = 40; // safety ceiling — prevents runaway sessions

    outerLoop: while (loopCount < MAX_LOOPS) {
      loopCount++;

      if (abortSignal.aborted) {
        emitAgentEvent({ type: 'session_killed', manifestId });
        break outerLoop;
      }

      // Phase 7C: Per-round SDK retry loop.
      // NETWORK_ERROR: 1 retry after 2s.  TOOL_ERROR: 3 retries (1s/2s/4s).
      // sleepMs rejects on AbortSignal so kill-switch and backoff are mutually exclusive.
      let sdkAttempt = 0;
      sdkRetryLoop: while (true) {
        if (abortSignal.aborted) break sdkRetryLoop;
        try {

      const stream = client.messages.stream({
        model: AGENT_COST_CONFIG.defaultModel,
        max_tokens: 8096,
        system: systemPrompt,
        tools: injectedTools,
        messages,
      });

      // Wire abort into the stream
      const onAbort = (): void => { stream.controller.abort(); };
      abortSignal.addEventListener('abort', onAbort, { once: true });

      // Track pending tool_use block
      let currentToolUseId: string | null = null;
      let currentToolName: string | null = null;
      let accumulatedInput = '';

      for await (const sdkEvent of stream) {
        if (abortSignal.aborted) break;

        switch (sdkEvent.type) {
          case 'content_block_start': {
            const block = sdkEvent.content_block;
            if (block.type === 'text') {
              currentToolUseId = null;
              currentToolName = null;
              accumulatedInput = '';
            } else if (block.type === 'tool_use') {
              currentToolUseId = block.id;
              currentToolName = block.name;
              accumulatedInput = '';
            }
            break;
          }

          case 'content_block_delta': {
            const delta = sdkEvent.delta;
            if (delta.type === 'text_delta' && delta.text) {
              logger.append(delta.text);
              callbacks.onLogLine(manifestId, delta.text);
              if (status === 'spawning') {
                emitAgentEvent({ type: 'text_delta', text: delta.text });
              }
            } else if (delta.type === 'input_json_delta') {
              accumulatedInput += delta.partial_json;
            }
            break;
          }

          case 'content_block_stop': {
            if (currentToolUseId && currentToolName) {
              const summary = accumulatedInput.length > 120
                ? accumulatedInput.slice(0, 117) + '...'
                : accumulatedInput;
              logger.append(`[tool_call] ${currentToolName}: ${summary}`);
              emitAgentEvent({
                type: 'tool_call',
                toolName: currentToolName,
                toolUseId: currentToolUseId,
                inputSummary: summary,
              });
              toolCallsSinceCheckpoint++;
              if (shouldCheckpoint()) writeCheckpoint();
            }
            break;
          }

          case 'message_delta': {
            if (sdkEvent.usage) {
              outputTokensTotal += sdkEvent.usage.output_tokens ?? 0;
              tokensUsedSoFar = inputTokensTotal + outputTokensTotal;
              costSoFar = calculateCost(inputTokensTotal, outputTokensTotal, AGENT_COST_CONFIG.defaultModel);
            }
            break;
          }

          case 'message_start': {
            if (sdkEvent.message.usage) {
              inputTokensTotal += sdkEvent.message.usage.input_tokens ?? 0;
              outputTokensTotal += sdkEvent.message.usage.output_tokens ?? 0;
              tokensUsedSoFar = inputTokensTotal + outputTokensTotal;
              costSoFar = calculateCost(inputTokensTotal, outputTokensTotal, AGENT_COST_CONFIG.defaultModel);
            }
            break;
          }
        }
      }

      abortSignal.removeEventListener('abort', onAbort);

      if (abortSignal.aborted) {
        emitAgentEvent({ type: 'session_killed', manifestId });
        break outerLoop;
      }

      // Get final message to check stop_reason and collect tool use blocks
      const finalMessage = await stream.finalMessage();

      // Update token counts from final message
      inputTokensTotal = finalMessage.usage.input_tokens ?? inputTokensTotal;
      outputTokensTotal = finalMessage.usage.output_tokens ?? outputTokensTotal;
      tokensUsedSoFar = inputTokensTotal + outputTokensTotal;
      costSoFar = calculateCost(inputTokensTotal, outputTokensTotal, AGENT_COST_CONFIG.defaultModel);

      if (finalMessage.stop_reason === 'end_turn') {
        const finalText    = extractTextContent(finalMessage.content);
        // Phase 7C: detect impossible task before calling it a normal completion
        const failureCheck = classifyStopReason(null, finalText, filesModified);
        if (failureCheck) {
          logger.append(`[error] ${failureCheck.mode}: ${failureCheck.message}`);
          emitAgentEvent({ type: 'error_terminal', message: failureCheck.message, context: failureCheck.mode });
          upsertJobState({
            manifest_id: manifestId, status: 'failed', steps_completed: stepsCompleted,
            files_modified: JSON.stringify(filesModified),
            last_event: JSON.stringify({ type: 'error', context: failureCheck.mode, message: failureCheck.message }),
            log_path: logger.logPath, tokens_used_so_far: tokensUsedSoFar, cost_so_far: costSoFar, updated_at: Date.now(),
          });
          updateSessionCost(manifestId, inputTokensTotal, outputTokensTotal, AGENT_COST_CONFIG.defaultModel);
          finalizeSessionCost(manifestId);
          clearSession(manifestId);
          deregisterLogger(manifestId);
          logger.close();
          callbacks.onComplete(manifestId, 'failed');
          return;
        }
        // Normal completion
        emitAgentEvent({
          type: 'session_final',
          resultSummary: finalText,
          totalTokens: tokensUsedSoFar,
          costUsd: costSoFar,
        });
        sessionCompletedNormally = true;
        break outerLoop;
      }

      if (finalMessage.stop_reason === 'tool_use') {
        // Execute tools and build tool_result messages
        const assistantContent = finalMessage.content;
        messages.push({ role: 'assistant', content: assistantContent });

        const toolResults: ToolResultBlockParam[] = [];

        for (const block of assistantContent) {
          if (block.type !== 'tool_use') continue;

          let parsedInput: Record<string, unknown> = {};
          if (typeof block.input === 'object' && block.input !== null) {
            parsedInput = block.input as Record<string, unknown>;
          }

          const result = await executeTool(block.name, parsedInput, manifest, manifestId);
          logger.append(`[tool_result] ${block.name}: ${result.slice(0, 200)}`);

          // Sprint 11.1: detectShimLoop via failure-modes pure function.
          // Runs after shim_check and supplements the retry-tracker sentinel check.
          if (block.name === 'shim_check' && !result.startsWith(SHIM_LOOP_SENTINEL) && !result.startsWith('ERROR')) {
            try {
              const shimJson = JSON.parse(result) as { health_score?: number };
              const shimFilePath = String(parsedInput['file_path'] ?? '');
              if (shimFilePath && shimJson.health_score !== undefined) {
                shimCallHistory.push({ file: shimFilePath, score: shimJson.health_score });
                if (detectShimLoop(shimCallHistory)) {
                  emitAgentEvent({
                    type: 'error_recoverable',
                    message: `SHIM loop detected on ${path.basename(shimFilePath)} — 3 calls with no score improvement (score: ${shimJson.health_score}).`,
                    toolTrace: 'shim_loop_failure_modes',
                  });
                }
              }
            } catch {
              // JSON parse failed — result was not a valid shim response, skip history update
            }
          }

          // Sprint 7G: detect SHIM_LOOP sentinel — emit blocked event for UI
          if (result.startsWith(SHIM_LOOP_SENTINEL)) {
            emitAgentEvent({
              type: 'error_recoverable',
              message: result.replace(SHIM_LOOP_SENTINEL + ': ', ''),
              toolTrace: 'shim_loop',
            });
          }

          // Track files modified (fs_write and fs_write_docs_only are the write tools)
          if ((block.name === 'fs_write' || block.name === 'fs_write_docs_only') && parsedInput['path']) {
            const writePath = String(parsedInput['path']);
            const resolved = path.isAbsolute(writePath)
              ? writePath
              : path.resolve(projectPath, writePath);
            if (!filesModified.includes(resolved)) {
              filesModified.push(resolved);
            }
          }

          stepsCompleted++;
          emitAgentEvent({
            type: 'tool_result',
            toolUseId: block.id,
            resultSummary: result.slice(0, 200),
            stepCount: stepsCompleted,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }

        messages.push({ role: 'user', content: toolResults });

        if (shouldCheckpoint()) writeCheckpoint();
        break sdkRetryLoop; // tool results appended — continue outer loop for next round
      }

      // Phase 7C: max_tokens → CONTEXT_LIMIT failure, no retry
      if (finalMessage.stop_reason === 'max_tokens') {
        const failureMsg = 'Context limit reached. Consider splitting into smaller tasks.';
        logger.append(`[error] ${FailureMode.CONTEXT_LIMIT}: ${failureMsg}`);
        emitAgentEvent({ type: 'error_terminal', message: failureMsg, context: FailureMode.CONTEXT_LIMIT });
        upsertJobState({
          manifest_id: manifestId, status: 'failed', steps_completed: stepsCompleted,
          files_modified: JSON.stringify(filesModified),
          last_event: JSON.stringify({ type: 'error', context: FailureMode.CONTEXT_LIMIT, message: failureMsg }),
          log_path: logger.logPath, tokens_used_so_far: tokensUsedSoFar, cost_so_far: costSoFar, updated_at: Date.now(),
        });
        updateSessionCost(manifestId, inputTokensTotal, outputTokensTotal, AGENT_COST_CONFIG.defaultModel);
        finalizeSessionCost(manifestId);
        clearSession(manifestId);
        deregisterLogger(manifestId);
        logger.close();
        callbacks.onComplete(manifestId, 'failed');
        return;
      }

      // Any other stop_reason (stop_sequence, etc.) — treat as completion
      emitAgentEvent({
        type: 'session_final',
        resultSummary: `Session ended with stop_reason: ${finalMessage.stop_reason ?? 'unknown'}`,
        totalTokens: tokensUsedSoFar,
        costUsd: costSoFar,
      });
      sessionCompletedNormally = true;
      break outerLoop;

        } catch (sdkErr) {
          // Phase 7C: classify and retry SDK-level errors
          if (abortSignal.aborted) break sdkRetryLoop;
          const sdkFailure = classifyError(sdkErr);
          const isNet      = sdkFailure.mode === FailureMode.NETWORK_ERROR;
          const maxAtt     = isNet ? 1 + RETRY_CONFIG.networkError.maxRetries : 1 + RETRY_CONFIG.toolError.maxRetries;
          const baseDelay  = isNet ? RETRY_CONFIG.networkError.baseDelayMs    : RETRY_CONFIG.toolError.baseDelayMs;

          if (sdkAttempt < maxAtt - 1) {
            sdkAttempt++;
            const delay = baseDelay * Math.pow(2, sdkAttempt - 1);
            logger.append(`[retry] ${sdkFailure.mode} attempt ${sdkAttempt}/${maxAtt - 1}: ${sdkFailure.message}`);
            try { await sleepMs(delay, abortSignal); } catch { break sdkRetryLoop; } // abort during sleep
            continue; // sdkRetryLoop
          }

          // All retries exhausted → terminal FAILED
          logger.append(`[error] ${sdkFailure.mode}: ${sdkFailure.message}`);
          emitAgentEvent({ type: 'error_terminal', message: sdkFailure.message, context: sdkFailure.mode });
          upsertJobState({
            manifest_id: manifestId, status: 'failed', steps_completed: stepsCompleted,
            files_modified: JSON.stringify(filesModified),
            last_event: JSON.stringify({ type: 'error', context: sdkFailure.mode, message: sdkFailure.message }),
            log_path: logger.logPath, tokens_used_so_far: tokensUsedSoFar, cost_so_far: costSoFar, updated_at: Date.now(),
          });
          updateSessionCost(manifestId, inputTokensTotal, outputTokensTotal, AGENT_COST_CONFIG.defaultModel);
          finalizeSessionCost(manifestId);
          clearSession(manifestId);
          deregisterLogger(manifestId);
          logger.close();
          callbacks.onComplete(manifestId, 'failed');
          return;
        }
      } // end sdkRetryLoop
    } // end outerLoop

    if (loopCount >= MAX_LOOPS) {
      emitAgentEvent({
        type: 'error_terminal',
        message: `Session exceeded maximum loop count (${MAX_LOOPS})`,
        context: 'safety_ceiling',
      });
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.append(`[error] ${error.message}`);

    emitAgentEvent({
      type: 'error_terminal',
      message: error.message,
      context: 'unhandled_exception',
    });

    // Final checkpoint on error
    upsertJobState({
      manifest_id: manifestId,
      status,
      steps_completed: stepsCompleted,
      files_modified: JSON.stringify(filesModified),
      last_event: JSON.stringify({ type: 'error', message: error.message }),
      log_path: logger.logPath,
      tokens_used_so_far: tokensUsedSoFar,
      cost_so_far: costSoFar,
      updated_at: Date.now(),
    });

    finalizeSessionCost(manifestId);
    clearSession(manifestId);
    deregisterLogger(manifestId);
    logger.close();
    callbacks.onError(manifestId, error);
    return;
  }

  // Sprint 7G: Post-processing SHIM gate
  // Runs before the final state write for code/self_evolution sessions that completed normally.
  // If any modified file scores < 70, the session is downgraded to FAILED before a PR can be created.
  if (!abortSignal.aborted && sessionCompletedNormally &&
      (sessionType === 'code' || sessionType === 'self_evolution') &&
      filesModified.length > 0) {
    logger.append('[shim] Running post-processing quality gate...');
    const postResult = runPostProcessingShim(manifestId, filesModified, projectPath);

    if (!postResult.passed) {
      const failMsg = postResult.failureReason ?? 'Post-processing SHIM gate failed.';
      logger.append(`[error] shim_gate: ${failMsg}`);
      emitAgentEvent({ type: 'error_terminal', message: failMsg, context: 'shim_gate' });
      upsertJobState({
        manifest_id: manifestId,
        status: 'failed',
        steps_completed: stepsCompleted,
        files_modified: JSON.stringify(filesModified),
        last_event: JSON.stringify({ type: 'error', context: 'shim_gate', message: failMsg }),
        log_path: logger.logPath,
        tokens_used_so_far: tokensUsedSoFar,
        cost_so_far: costSoFar,
        updated_at: Date.now(),
      });
      updateSessionCost(manifestId, inputTokensTotal, outputTokensTotal, AGENT_COST_CONFIG.defaultModel);
      finalizeSessionCost(manifestId);
      clearSession(manifestId);
      deregisterLogger(manifestId);
      logger.close();
      callbacks.onComplete(manifestId, 'failed');
      return;
    }

    logger.append(`[shim] Post-processing passed. Average score: ${postResult.shim_score_after.toFixed(1)}`);
  }

  // Final state write
  const finalStatus = abortSignal.aborted ? 'interrupted' : status;
  upsertJobState({
    manifest_id: manifestId,
    status: finalStatus,
    steps_completed: stepsCompleted,
    files_modified: JSON.stringify(filesModified),
    last_event: JSON.stringify({ type: 'session_end', status: finalStatus }),
    log_path: logger.logPath,
    tokens_used_so_far: tokensUsedSoFar,
    cost_so_far: costSoFar,
    updated_at: Date.now(),
  });

  // Phase 7D: persist final cost and mark session complete
  updateSessionCost(manifestId, inputTokensTotal, outputTokensTotal, AGENT_COST_CONFIG.defaultModel);
  finalizeSessionCost(manifestId);

  clearSession(manifestId);
  deregisterLogger(manifestId);
  logger.close();
  callbacks.onComplete(manifestId, finalStatus);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTextContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
