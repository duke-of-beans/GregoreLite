/**
 * Agent SDK Types
 *
 * Core interfaces for GregLite worker session infrastructure.
 * TaskManifest and JobState are also consumed by Sprint 2E (War Room).
 *
 * BLUEPRINT §4.1 + §4.2 + §4.3.2
 */

// ─── Job State Machine ────────────────────────────────────────────────────────

export type JobState =
  | 'SPAWNING'
  | 'RUNNING'
  | 'WORKING'
  | 'VALIDATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'INTERRUPTED';

// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskType = 'code' | 'test' | 'docs' | 'research' | 'deploy' | 'self_evolution';

// ─── Task Manifest ────────────────────────────────────────────────────────────

export interface TaskManifestFile {
  path: string;
  purpose: 'read' | 'modify' | 'create';
  initial_content?: string;
}

export interface TaskManifestEnvironment {
  node_version?: string;
  python_version?: string;
  env_vars?: Record<string, string>;
}

export interface TaskManifest {
  manifest_id: string;
  version: '1.0';
  spawned_by: {
    thread_id: string;
    strategic_thread_id: string;
    timestamp: string; // ISO
  };
  task: {
    id: string;
    type: TaskType;
    title: string;
    description: string;
    success_criteria: string[];
  };
  context: {
    project_path: string;
    files: TaskManifestFile[];
    environment: TaskManifestEnvironment;
    // Amendment 6: required from Phase 1, not optional
    dependencies: string[]; // manifest_ids that must complete first
    dependency_graph_notes?: string;
  };
  protocol: {
    output_format: 'json' | 'markdown' | 'code' | 'mixed';
    reporting_interval: number; // seconds
    max_duration: number; // minutes
  };
  return_to_thread: {
    id: string;
    on_success: 'report' | 'commit' | 'pr';
    on_failure: 'retry' | 'report' | 'escalate';
  };
  quality_gates: {
    shim_required: boolean;
    eos_required: boolean;
    tests_required: boolean;
  };
  // Amendment 7: self-evolution tagging
  is_self_evolution: boolean;
  self_evolution_branch?: string;
}

// ─── Result Report ────────────────────────────────────────────────────────────

export interface ResultReport {
  manifest_id: string;
  status: 'success' | 'failure' | 'partial';
  started_at: string; // ISO
  completed_at: string; // ISO
  duration_seconds: number;
  output: {
    files_created: string[];
    files_modified: string[];
    test_results?: {
      passed: number;
      failed: number;
      coverage?: number;
    };
    artifacts: Array<{
      name: string;
      path: string;
      type: string;
    }>;
    logs_path: string;
  };
  quality_results: {
    shim?: { score: number; issues: unknown[] };
    eos?: { healthScore?: number; vulnerabilities: unknown[]; drifts: unknown[] };
  };
  tokens_used: number;
  cost_usd: number;
  errors?: Array<{ message: string; phase: string }>;
}

// ─── Job Record (in-memory runtime state) ────────────────────────────────────

export interface JobRecord {
  jobId: string; // = manifest_id
  manifest: TaskManifest;
  state: JobState;
  priority: number;
  startedAt: string | null;
  completedAt: string | null;
  currentStep: number;
  totalSteps: number;
  tokensUsed: number;
  costUsd: number;
  logLines: string[];
  resultReport: ResultReport | null;
  abortController: AbortController | null;
}

// ─── Workload Priority ────────────────────────────────────────────────────────

export const TASK_PRIORITY: Record<TaskType, number> = {
  self_evolution: 90,
  code: 70,
  test: 70,
  docs: 40,
  research: 40,
  deploy: 60,
};

// ─── Token Usage (from SDK streaming events) ──────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}
