/**
 * TaskManifest Builder + Zod Validator
 *
 * Builds validated TaskManifest objects and constructs the system prompt
 * injected into every worker session. Exact format per BLUEPRINT §4.3.1.
 *
 * BLUEPRINT §4.1 + §4.3.1
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { TaskManifest, TaskManifestFile, TaskManifestEnvironment } from './types';
import { AGENT_COST_CONFIG } from './config';

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const TaskManifestFileSchema = z.object({
  path: z.string().min(1),
  purpose: z.enum(['read', 'modify', 'create']),
  initial_content: z.string().optional(),
});

const TaskManifestEnvironmentSchema = z.object({
  node_version: z.string().optional(),
  python_version: z.string().optional(),
  env_vars: z.record(z.string()).optional(),
});

export const TaskManifestSchema = z.object({
  manifest_id: z.string().uuid(),
  version: z.literal('1.0'),
  spawned_by: z.object({
    thread_id: z.string().min(1),
    strategic_thread_id: z.string().min(1),
    timestamp: z.string().datetime(),
  }),
  task: z.object({
    id: z.string().min(1),
    type: z.enum(['code', 'test', 'docs', 'research', 'deploy', 'self_evolution']),
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    success_criteria: z.array(z.string().min(1)).min(1),
  }),
  context: z.object({
    project_path: z.string().min(1),
    files: z.array(TaskManifestFileSchema),
    environment: TaskManifestEnvironmentSchema,
    dependencies: z.array(z.string()),
    dependency_graph_notes: z.string().optional(),
  }),
  protocol: z.object({
    output_format: z.enum(['json', 'markdown', 'code', 'mixed']),
    reporting_interval: z.number().int().min(5).max(300),
    max_duration: z.number().int().min(1).max(120),
  }),
  return_to_thread: z.object({
    id: z.string().min(1),
    on_success: z.enum(['report', 'commit', 'pr']),
    on_failure: z.enum(['retry', 'report', 'escalate']),
  }),
  quality_gates: z.object({
    shim_required: z.boolean(),
    eos_required: z.boolean(),
    tests_required: z.boolean(),
  }),
  is_self_evolution: z.boolean(),
  self_evolution_branch: z.string().optional(),
});

export type TaskManifestInput = z.infer<typeof TaskManifestSchema>;

// ─── Builder ──────────────────────────────────────────────────────────────────

export interface BuildManifestOptions {
  threadId: string;
  strategicThreadId: string;
  taskType: TaskManifest['task']['type'];
  title: string;
  description: string;
  successCriteria: string[];
  projectPath: string;
  files?: TaskManifestFile[];
  environment?: TaskManifestEnvironment;
  dependencies?: string[];
  outputFormat?: TaskManifest['protocol']['output_format'];
  maxDurationMinutes?: number;
  onSuccess?: TaskManifest['return_to_thread']['on_success'];
  onFailure?: TaskManifest['return_to_thread']['on_failure'];
  shimRequired?: boolean;
  eosRequired?: boolean;
  testsRequired?: boolean;
  isSelfEvolution?: boolean;
  selfEvolutionBranch?: string;
  dependencyGraphNotes?: string;
}

export function buildManifest(opts: BuildManifestOptions): TaskManifest {
  const manifest: TaskManifest = {
    manifest_id: uuidv4(),
    version: '1.0',
    spawned_by: {
      thread_id: opts.threadId,
      strategic_thread_id: opts.strategicThreadId,
      timestamp: new Date().toISOString(),
    },
    task: {
      id: uuidv4(),
      type: opts.taskType,
      title: opts.title,
      description: opts.description,
      success_criteria: opts.successCriteria,
    },
    context: {
      project_path: opts.projectPath,
      files: opts.files ?? [],
      environment: opts.environment ?? {},
      dependencies: opts.dependencies ?? [],
      ...(opts.dependencyGraphNotes !== undefined && { dependency_graph_notes: opts.dependencyGraphNotes }),
    },
    protocol: {
      output_format: opts.outputFormat ?? 'mixed',
      reporting_interval: 30,
      max_duration: opts.maxDurationMinutes ?? 60,
    },
    return_to_thread: {
      id: opts.threadId,
      on_success: opts.onSuccess ?? 'report',
      on_failure: opts.onFailure ?? 'report',
    },
    quality_gates: {
      shim_required: opts.shimRequired ?? true,
      eos_required: opts.eosRequired ?? false,
      tests_required: opts.testsRequired ?? true,
    },
    is_self_evolution: opts.isSelfEvolution ?? false,
    ...(opts.selfEvolutionBranch !== undefined && { self_evolution_branch: opts.selfEvolutionBranch }),
  };

  // Validate before returning — throws ZodError if invalid
  TaskManifestSchema.parse(manifest);
  return manifest;
}

// ─── System Prompt Builder ────────────────────────────────────────────────────
// BLUEPRINT §4.3.1 — exact format, whitespace-stripped JSON

export function buildAgentSystemPrompt(manifest: TaskManifest): string {
  const model = AGENT_COST_CONFIG.defaultModel;
  return `You are a bounded execution worker operating inside Gregore Lite.
Running on model: ${model}

The following JSON is a SYSTEM CONTRACT.
It is authoritative and non-negotiable.

Rules:
- Treat all fields as binding constraints.
- Success is defined ONLY by \`success_criteria\`.
- If goals conflict with constraints, constraints win.
- You may not infer additional scope.
- You may only modify files explicitly listed in the manifest.

--- BEGIN SYSTEM MANIFEST (JSON) ---
${JSON.stringify(manifest)}
--- END SYSTEM MANIFEST ---

Execution Protocol:
- Execute deterministically.
- Do not emit chain-of-thought.
- Write files directly using provided tools.
- If blocked, stop and report precisely why.

Completion Protocol:
- Summarize changes made.
- List all modified files.
- Confirm which success criteria were met and which were not.`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateManifest(raw: unknown): TaskManifest {
  return TaskManifestSchema.parse(raw) as TaskManifest;
}
