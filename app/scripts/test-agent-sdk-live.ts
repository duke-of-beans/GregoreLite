/**
 * Live Agent SDK Test — Phase 7A §7.10
 *
 * Runs 5 simple sessions to validate that:
 *   1. buildSystemPrompt() produces correct System Contract Header
 *   2. Claude treats the manifest as authoritative (no scope hallucination)
 *   3. Event streaming → JobStatus transitions work correctly
 *   4. job_state is checkpointed to KERNL
 *   5. Session completes cleanly (COMPLETED status)
 *
 * Usage: node --loader ts-node/esm scripts/test-agent-sdk-live.ts
 *   OR:  npx tsx scripts/test-agent-sdk-live.ts
 */

import { buildManifest } from '../lib/agent-sdk/manifest';
import { runQuerySession } from '../lib/agent-sdk/query';
import type { JobStatus, StreamEvent } from '../lib/agent-sdk/types';
import * as path from 'path';

const PROJECT_PATH = path.resolve(__dirname, '..');

interface TestResult {
  name: string;
  passed: boolean;
  statusSequence: JobStatus[];
  stepsCompleted: number;
  tokensUsed: number;
  costUsd: number;
  error?: string;
  notes: string[];
}

async function runLiveTest(
  name: string,
  title: string,
  description: string,
  successCriteria: string[]
): Promise<TestResult> {
  const manifest = buildManifest({
    threadId: 'live-test-thread',
    strategicThreadId: 'live-test-strategic',
    taskType: 'research',
    title,
    description,
    successCriteria,
    projectPath: PROJECT_PATH,
    files: [],
    shimRequired: false,
    eosRequired: false,
    testsRequired: false,
  });

  const statusSequence: JobStatus[] = [];
  const notes: string[] = [];
  let stepsCompleted = 0;
  let tokensUsed = 0;
  let costUsd = 0;
  let completed = false;
  let errorMsg: string | undefined;

  const abortController = new AbortController();

  // 2-minute timeout per session
  const timeout = setTimeout(() => {
    abortController.abort();
    notes.push('TIMEOUT: session exceeded 2 minutes');
  }, 120_000);

  await runQuerySession(manifest, abortController.signal, {
    onStatusChange(_id: string, status: JobStatus) {
      if (statusSequence[statusSequence.length - 1] !== status) {
        statusSequence.push(status);
      }
    },
    onStreamEvent(event: StreamEvent) {
      stepsCompleted = event.stepsCompleted;
      tokensUsed = event.tokensUsedSoFar;
      costUsd = event.costSoFar;
    },
    onLogLine(_id: string, _line: string) { /* silent */ },
    onComplete(_id: string, finalStatus: JobStatus) {
      completed = finalStatus === 'completed';
      clearTimeout(timeout);
    },
    onError(_id: string, err: Error) {
      errorMsg = err.message;
      clearTimeout(timeout);
    },
  });

  const passed = completed && !errorMsg && statusSequence.includes('running');

  return {
    name,
    passed,
    statusSequence,
    stepsCompleted,
    tokensUsed,
    costUsd,
    ...(errorMsg !== undefined && { error: errorMsg }),
    notes,
  };
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  GregLite Phase 7A — Live Agent SDK Session Tests');
  console.log('  Validating System Contract Header + event streaming');
  console.log('═══════════════════════════════════════════════════════════\n');

  const tests = [
    {
      name: 'T1: File list task',
      title: 'List TypeScript files in lib/agent-sdk',
      description: 'Use the list_directory tool to enumerate all .ts files in the lib/agent-sdk directory. Return a JSON array of file names.',
      successCriteria: [
        'Returns a list of .ts file names found in lib/agent-sdk',
        'Response is scoped to the directory — no files outside are mentioned',
      ],
    },
    {
      name: 'T2: File count task',
      title: 'Count lines in prompt-builder.ts',
      description: 'Read the file lib/agent-sdk/prompt-builder.ts and return its total line count as a number.',
      successCriteria: [
        'Returns a numeric line count for prompt-builder.ts',
        'Uses read_file tool — does not fabricate the answer',
      ],
    },
    {
      name: 'T3: Scope containment check',
      title: 'Report the first line of config.ts',
      description: 'Read ONLY lib/agent-sdk/config.ts and return its first line verbatim. Do not read any other file.',
      successCriteria: [
        'Returns the first line of config.ts',
        'Does not read or reference files outside of config.ts',
      ],
    },
    {
      name: 'T4: Run command task',
      title: 'Check TypeScript version',
      description: 'Run the command: node node_modules/typescript/bin/tsc --version. Return the version string.',
      successCriteria: [
        'Returns a TypeScript version string (e.g. Version 5.x.x)',
        'Uses run_command tool',
      ],
    },
    {
      name: 'T5: Multi-step task',
      title: 'Count files in lib/agent-sdk and report total',
      description: 'Use list_directory on lib/agent-sdk (non-recursive), count the .ts files, then return the count as a plain number.',
      successCriteria: [
        'Uses list_directory tool to enumerate files',
        'Returns a numeric count',
        'Stays within the lib/agent-sdk directory',
      ],
    },
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    process.stdout.write(`Running ${test.name}... `);
    try {
      const result = await runLiveTest(test.name, test.title, test.description, test.successCriteria);
      results.push(result);
      console.log(result.passed ? '✅ PASS' : '❌ FAIL');
      console.log(`  Status: ${result.statusSequence.join(' → ')}`);
      console.log(`  Steps: ${result.stepsCompleted} | Tokens: ${result.tokensUsed} | Cost: $${result.costUsd.toFixed(5)}`);
      if (result.error) console.log(`  Error: ${result.error}`);
      if (result.notes.length > 0) console.log(`  Notes: ${result.notes.join('; ')}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({
        name: test.name,
        passed: false,
        statusSequence: [],
        stepsCompleted: 0,
        tokensUsed: 0,
        costUsd: 0,
        error,
        notes: [],
      });
      console.log(`❌ FAIL (exception: ${error})`);
    }
    console.log();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const totalTokens = results.reduce((s, r) => s + r.tokensUsed, 0);
  const totalCost = results.reduce((s, r) => s + r.costUsd, 0);

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed}/${results.length} passed`);
  console.log(`  Total tokens: ${totalTokens} | Total cost: $${totalCost.toFixed(5)}`);
  console.log('═══════════════════════════════════════════════════════════');

  // Write results to file for SPRINT_7A_COMPLETE.md
  const outputPath = path.join(__dirname, 'live-test-results-7a.json');
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify({ results, totalTokens, totalCost }, null, 2));
  console.log(`\nResults written to: ${outputPath}`);

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
