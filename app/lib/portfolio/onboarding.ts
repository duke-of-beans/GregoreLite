/**
 * Portfolio Onboarding — Sprint 25.0
 *
 * Question flow logic for the "Add Existing Project" onboarding.
 * Determines which questions to ask based on scan confidence,
 * generates PROJECT_DNA.yaml content from answers,
 * and captures anonymized telemetry.
 *
 * Public API:
 *   getOnboardingQuestions(scan, inferred)     — returns question list
 *   generateDnaFromAnswers(scan, answers)       — returns YAML string
 *   captureOnboardingTelemetry(params)          — writes to portfolio_telemetry
 */

import { getDatabase } from '@/lib/kernl/database';
import { stringify as stringifyYaml } from 'yaml';
import type {
  DirectoryScanResult,
  InferResult,
  OnboardingQuestion,
  ProjectDnaYaml,
  ProjectType,
} from './types';

// ── Question definitions ──────────────────────────────────────────────────────

const CORE_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'purpose',
    question: 'What is this project actually for?',
    context: 'Purpose, goal, or problem being solved.',
  },
  {
    id: 'inputs',
    question: 'What are the inputs you work with?',
    context: 'Files, data, people, raw materials — whatever you feed into this.',
  },
  {
    id: 'done_looks',
    question: 'What does done look like for this?',
    context: 'The definition of completion or a successful deliverable.',
  },
  {
    id: 'constraints',
    question: 'What are the constraints or deadlines?',
    context: 'Time, budget, scope, dependencies. Skip if none.',
  },
  {
    id: 'success_signal',
    question: 'How do you know if it\'s going well or badly?',
    context: 'Metrics, signals, or gut checks you actually use.',
  },
];

const RESEARCH_QUESTIONS: OnboardingQuestion[] = [
  { id: 'research_question', question: 'What\'s the central research question?', context: 'The specific question you\'re trying to answer.' },
  { id: 'methodology',       question: 'What methodology or framework are you using?', context: 'Qualitative, quantitative, mixed, or domain-specific approach.' },
  { id: 'outputs',           question: 'What are the expected outputs?', context: 'Papers, reports, datasets, presentations.' },
  { id: 'timeline',          question: 'Is there a deadline or submission target?', context: 'Conference, journal, or internal deadline.' },
];

const BUSINESS_QUESTIONS: OnboardingQuestion[] = [
  { id: 'deliverable',  question: 'What\'s the primary deliverable?', context: 'What you\'re building or shipping for the client or market.' },
  { id: 'client',       question: 'Who\'s the client or audience?', context: 'Internal team, external client, or end users.' },
  { id: 'milestones',   question: 'What are the key milestones?', context: 'Named phases, due dates, or gates.' },
  { id: 'success_kpi',  question: 'What does success look like — revenue, deliverables shipped, something else?', context: 'The KPI that matters most.' },
];

const CREATIVE_QUESTIONS: OnboardingQuestion[] = [
  { id: 'medium',             question: 'What medium — writing, visual, audio, video, mixed?', context: 'Primary creative medium.' },
  { id: 'audience',           question: 'Who\'s this for?', context: 'Audience, client, or intended viewers/readers/listeners.' },
  { id: 'scope',              question: 'What\'s the scope — one piece, a series, an ongoing practice?', context: 'Bounded project vs ongoing work.' },
  { id: 'completion_signal',  question: 'How do you know when a piece is done?', context: 'Your personal done criteria.' },
];

const CODE_CONFIRM_QUESTIONS = (scan: DirectoryScanResult, lang: string): OnboardingQuestion[] => {
  const srcCount = Object.entries(scan.fileDistribution)
    .filter(([ext]) => ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.cs'].includes(ext))
    .reduce((a, [, c]) => a + c, 0);
  const hasSuite = scan.structure.includes('tests') || scan.structure.includes('test');
  return [
    {
      id: 'code_confirm',
      question: `I found a ${lang} project with ${srcCount} source files${hasSuite ? ' and a test suite' : ''}. Sound right?`,
      options: ['Yes', 'Not quite — let me clarify'],
    },
    {
      id: 'extra_metrics',
      question: 'Any specific metrics you want to track beyond the defaults?',
      context: 'Defaults: test count, TSC errors, last commit. Add anything extra.',
    },
  ];
};

// ── Public: getOnboardingQuestions ───────────────────────────────────────────

/**
 * Returns the ordered question list for this scan + inference result.
 * High confidence → 2 confirming questions.
 * Medium confidence → type-specific 4-question set.
 * Low confidence / custom → 5 core questions.
 */
export function getOnboardingQuestions(
  scan: DirectoryScanResult,
  inferred: InferResult,
): OnboardingQuestion[] {
  const { type, confidence } = inferred;

  if (confidence === 'high') {
    const lang = inferLang(scan);
    return CODE_CONFIRM_QUESTIONS(scan, lang);
  }

  if (confidence === 'medium') {
    switch (type) {
      case 'research': return RESEARCH_QUESTIONS;
      case 'business': return BUSINESS_QUESTIONS;
      case 'creative': return CREATIVE_QUESTIONS;
      default:         return CORE_QUESTIONS;
    }
  }

  // Low confidence / custom → full 5-question set
  return CORE_QUESTIONS;
}

function inferLang(scan: DirectoryScanResult): string {
  const bs = scan.buildSystem;
  if (bs.includes('Cargo.toml'))   return 'Rust';
  if (bs.includes('go.mod'))       return 'Go';
  if (bs.includes('pyproject.toml') || bs.includes('setup.py')) return 'Python';
  if (bs.includes('pom.xml') || bs.includes('build.gradle'))    return 'Java/JVM';
  if (bs.includes('.csproj'))      return '.NET';
  if (bs.includes('tsconfig.json')) return 'TypeScript';
  return 'JavaScript';
}

// ── Public: generateDnaFromAnswers ────────────────────────────────────────────

/**
 * Produce a complete PROJECT_DNA.yaml content string from scan + answers.
 * answers keys match OnboardingQuestion.id values.
 */
export function generateDnaFromAnswers(
  scan: DirectoryScanResult,
  answers: Record<string, string>,
  inferred: InferResult,
  projectName: string,
): { yaml: string; dna: ProjectDnaYaml } {
  const folderName = scan.path.split(/[\\/]/).pop() ?? 'Unknown';
  const name = projectName.trim() || folderName;

  // Determine final type (user may have corrected inferred type)
  const finalType: ProjectType = inferred.type;

  // Build metrics appropriate to the type
  const metrics = buildMetrics(finalType, scan, answers);

  // Build documents list from what was found
  const documents = scan.documentation.slice(0, 8);
  if (!documents.includes('PROJECT_DNA.yaml')) documents.unshift('PROJECT_DNA.yaml');
  if (!documents.includes('STATUS.md'))        documents.splice(1, 0, 'STATUS.md');

  const dna: ProjectDnaYaml = {
    type: finalType,
    ...(finalType === 'custom' ? { type_label: answers['purpose']?.slice(0, 40) ?? 'Custom' } : {}),
    identity: {
      name,
      purpose: answers['purpose'] ?? answers['research_question'] ?? answers['deliverable'] ?? inferred.reason,
    },
    current_state: {
      phase: 'Phase 1 — Initial setup',
      status: 'Registered via GregLite onboarding.',
    },
    metrics,
    documents,
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const obj: Record<string, unknown> = {
    identity: dna.identity,
    type: dna.type,
    ...(dna.type_label ? { type_label: dna.type_label } : {}),
    current_state: dna.current_state,
    metrics: dna.metrics,
    documents: dna.documents,
  };
  const yaml = `# PROJECT_DNA.yaml\n# Generated by GregLite onboarding — ${dateStr}\n\n${stringifyYaml(obj)}`;

  return { yaml, dna };
}

function buildMetrics(
  type: ProjectType,
  scan: DirectoryScanResult,
  answers: Record<string, string>,
): Record<string, string | number | null> {
  switch (type) {
    case 'code':
      return {
        last_commit: scan.versionControl.lastCommitDate ?? null,
        branch:      scan.versionControl.branch ?? null,
        test_count:  null,
        tsc_errors:  null,
      };
    case 'research':
      return {
        research_question: answers['research_question'] ?? null,
        methodology:       answers['methodology'] ?? null,
        outputs:           answers['outputs'] ?? null,
        deadline:          answers['timeline'] ?? null,
        document_count:    scan.fileDistribution['.pdf'] ?? 0,
      };
    case 'business':
      return {
        deliverable:    answers['deliverable'] ?? null,
        client:         answers['client'] ?? null,
        milestones:     answers['milestones'] ?? null,
        success_kpi:    answers['success_kpi'] ?? null,
      };
    case 'creative':
      return {
        medium:             answers['medium'] ?? null,
        audience:           answers['audience'] ?? null,
        scope:              answers['scope'] ?? null,
        completion_signal:  answers['completion_signal'] ?? null,
      };
    default: {
      // Custom: derive metrics from core question answers
      const metrics: Record<string, string | number | null> = {};
      if (answers['inputs'])         metrics['inputs']         = answers['inputs'];
      if (answers['done_looks'])     metrics['done_looks_like']= answers['done_looks'];
      if (answers['constraints'])    metrics['constraints']    = answers['constraints'];
      if (answers['success_signal']) metrics['success_signal'] = answers['success_signal'];
      return metrics;
    }
  }
}

// ── Public: captureOnboardingTelemetry ───────────────────────────────────────

export interface TelemetryParams {
  projectType: ProjectType;
  customTypeLabel?: string | undefined;
  questionsAsked: string[];
  metricsConfigured: string[];
  templateUsed: string;
  onboardingDurationSeconds: number;
}

/**
 * Write an anonymized row to portfolio_telemetry.
 * NO project names, paths, file contents, or user answers stored.
 */
export function captureOnboardingTelemetry(params: TelemetryParams): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO portfolio_telemetry
        (project_type, custom_type_label, questions_asked, metrics_configured,
         template_used, migration_vs_new, onboarding_duration_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, 'migration', ?, ?)
    `).run(
      params.projectType,
      params.customTypeLabel ?? null,
      JSON.stringify(params.questionsAsked),
      JSON.stringify(params.metricsConfigured),
      params.templateUsed,
      params.onboardingDurationSeconds,
      Date.now(),
    );
  } catch (err) {
    // Telemetry is non-critical — never bubble up
    console.warn('[portfolio/onboarding] Telemetry write failed:', err);
  }
}

// ── Re-export types ───────────────────────────────────────────────────────────
export type { OnboardingQuestion, ProjectDnaYaml };
