'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, cardLift } from '@/lib/design/animations';
import { SCAFFOLD } from '@/lib/voice/copy-templates';
import type { ProjectType } from '@/lib/portfolio/types';
import { apiFetch } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewProjectFlowProps {
  onComplete: (projectId: string) => void;
  onCancel: () => void;
  defaultPath?: string;
}

type FlowStep =
  | 'describe'
  | 'questions'
  | 'preview'
  | 'path'
  | 'scaffolding'
  | 'complete';

interface InferResult {
  type: ProjectType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

interface QuestionAnswer {
  key: string;
  label: string;
  answer: string;
}

interface ScaffoldPreviewFile {
  name: string;
  description: string;
}

// ─── Step 1: Describe ─────────────────────────────────────────────────────────

function DescribeStep({
  onSubmit,
}: {
  onSubmit: (description: string) => void;
}) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!value.trim()) return;
    setLoading(true);
    await onSubmit(value.trim());
    setLoading(false);
  }, [value, onSubmit]);

  return (
    <motion.div {...fadeIn} className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {SCAFFOLD.prompts.describe}
      </p>
      <textarea
        autoFocus
        className="w-full min-h-[80px] resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        placeholder={SCAFFOLD.prompts.describePlaceholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
      />
      <div className="flex justify-end">
        <button
          disabled={!value.trim() || loading}
          onClick={handleSubmit}
          className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {loading ? SCAFFOLD.steps.analyzing : SCAFFOLD.steps.continue}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Step 2: Questions ────────────────────────────────────────────────────────

interface Question {
  key: string;
  label: string;
  placeholder?: string;
  optional?: boolean;
}

function QuestionsStep({
  questions,
  inferred,
  onSubmit,
}: {
  questions: Question[];
  inferred: InferResult;
  onSubmit: (answers: QuestionAnswer[]) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.key, ''])),
  );

  const allRequired = questions
    .filter((q) => !q.optional)
    .every((q) => answers[q.key]?.trim());

  const handleSubmit = () => {
    const result: QuestionAnswer[] = questions.map((q) => ({
      key: q.key,
      label: q.label,
      answer: answers[q.key] ?? '',
    }));
    onSubmit(result);
  };

  return (
    <motion.div {...fadeIn} className="flex flex-col gap-4">
      {inferred.confidence !== 'low' && (
        <div className="rounded-md bg-[var(--color-surface-raised)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          {SCAFFOLD.inference.detected(inferred.type, inferred.confidence)}
        </div>
      )}
      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <div key={q.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {q.label}
              {q.optional && (
                <span className="ml-1 text-[var(--color-text-tertiary)]">
                  (optional)
                </span>
              )}
            </label>
            <input
              type="text"
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              placeholder={q.placeholder ?? ''}
              value={answers[q.key] ?? ''}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          disabled={!allRequired}
          onClick={handleSubmit}
          className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {SCAFFOLD.steps.preview}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Step 3: Scaffold Preview ─────────────────────────────────────────────────

function PreviewStep({
  files,
  projectName,
  onConfirm,
}: {
  files: ScaffoldPreviewFile[];
  projectName: string;
  onConfirm: () => void;
}) {
  return (
    <motion.div {...fadeIn} className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {SCAFFOLD.preview.intro(projectName, files.length)}
      </p>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
        {files.map((f) => (
          <div key={f.name} className="flex flex-col px-3 py-2">
            <span className="font-mono text-xs text-[var(--color-text-primary)]">
              {f.name}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              {f.description}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white hover:opacity-90 transition-opacity"
        >
          {SCAFFOLD.steps.choosePath}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Step 4: Path Selection ───────────────────────────────────────────────────

function PathStep({
  defaultPath,
  projectName,
  onConfirm,
}: {
  defaultPath: string;
  projectName: string;
  onConfirm: (path: string) => void;
}) {
  const suggestedPath = `${defaultPath}/${projectName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}`;
  const [path, setPath] = useState(suggestedPath);

  return (
    <motion.div {...fadeIn} className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {SCAFFOLD.prompts.pathPrompt}
      </p>
      <input
        type="text"
        autoFocus
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 font-mono text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        value={path}
        onChange={(e) => setPath(e.target.value)}
      />
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {SCAFFOLD.prompts.pathHint}
      </p>
      <div className="flex justify-end">
        <button
          disabled={!path.trim()}
          onClick={() => onConfirm(path.trim())}
          className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {SCAFFOLD.steps.create}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Step 5: Scaffolding (in progress) ───────────────────────────────────────

function ScaffoldingStep() {
  return (
    <motion.div {...fadeIn} className="flex flex-col items-center gap-3 py-4">
      <div className="h-5 w-5 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
      <p className="text-sm text-[var(--color-text-secondary)]">
        {SCAFFOLD.steps.scaffolding}
      </p>
    </motion.div>
  );
}

// ─── Step 6: Complete ─────────────────────────────────────────────────────────

function CompleteStep({
  projectId: _projectId,
  projectName,
  filesCreated,
  onViewProject,
}: {
  projectId: string;
  projectName: string;
  filesCreated: number;
  onViewProject: () => void;
}) {
  return (
    <motion.div {...fadeIn} className="flex flex-col gap-4">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {SCAFFOLD.completion.title(projectName)}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {SCAFFOLD.completion.filesCreated(filesCreated)}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          {SCAFFOLD.completion.hint}
        </p>
      </div>
      <div className="flex justify-end">
        <button
          onClick={onViewProject}
          className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white hover:opacity-90 transition-opacity"
        >
          {SCAFFOLD.steps.viewProject}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Flow ────────────────────────────────────────────────────────────────

export default function NewProjectFlow({
  onComplete,
  onCancel,
  defaultPath = '~/Projects',
}: NewProjectFlowProps) {
  const [step, setStep] = useState<FlowStep>('describe');
  const [_description, setDescription] = useState('');
  const [inferred, setInferred] = useState<InferResult | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [projectName, setProjectName] = useState('');
  const [scaffoldFiles, setScaffoldFiles] = useState<ScaffoldPreviewFile[]>([]);
  const [_dirPath, setDirPath] = useState('');
  const [completedProjectId, setCompletedProjectId] = useState('');
  const [filesCreated, setFilesCreated] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Step 1 → 2: infer type, fetch questions
  const handleDescribe = useCallback(async (desc: string) => {
    setDescription(desc);
    setError(null);

    try {
      const res = await apiFetch('/api/portfolio/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Inference failed');

      const { inferred: inf, questions: qs, projectName: pName } = json.data as {
        inferred: InferResult;
        questions: Question[];
        projectName: string;
      };

      setInferred(inf);
      setQuestions(qs);
      setProjectName(pName);
      setStep('questions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, []);

  // Step 2 → 3: build preview from answers
  const handleAnswers = useCallback(
    async (qa: QuestionAnswer[]) => {
      setAnswers(qa);
      setError(null);

      if (!inferred) return;

      try {
        const res = await apiFetch('/api/portfolio/scaffold/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: inferred.type,
            answers: Object.fromEntries(qa.map((a) => [a.key, a.answer])),
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Preview failed');

        setScaffoldFiles(json.data.files as ScaffoldPreviewFile[]);
        setStep('preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    },
    [inferred],
  );

  // Step 3 → 4
  const handlePreviewConfirm = useCallback(() => setStep('path'), []);

  // Step 4 → 5 → 6: scaffold
  const handlePathConfirm = useCallback(
    async (path: string) => {
      setDirPath(path);
      setStep('scaffolding');
      setError(null);

      if (!inferred) return;

      try {
        const answersMap = Object.fromEntries(
          answers.map((a) => [a.key, a.answer]),
        );
        const res = await apiFetch('/api/portfolio/scaffold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: projectName,
            type: inferred.type,
            dirPath: path,
            answers: answersMap,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Scaffold failed');

        const { projectId: newProjectId, filesCreated: fc } = json.data as {
          projectId: string;
          filesCreated: number;
        };
        setCompletedProjectId(newProjectId);
        setFilesCreated(fc);
        setStep('complete');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Scaffold failed');
        setStep('path'); // regress to path selection so user can retry
      }
    },
    [inferred, answers, projectName],
  );

  const stepLabels: Record<FlowStep, string> = {
    describe: SCAFFOLD.stepLabels.describe,
    questions: SCAFFOLD.stepLabels.questions,
    preview: SCAFFOLD.stepLabels.preview,
    path: SCAFFOLD.stepLabels.path,
    scaffolding: SCAFFOLD.stepLabels.scaffolding,
    complete: SCAFFOLD.stepLabels.complete,
  };

  const stepOrder: FlowStep[] = [
    'describe',
    'questions',
    'preview',
    'path',
    'scaffolding',
    'complete',
  ];
  const stepIndex = stepOrder.indexOf(step);

  return (
    <motion.div
      {...cardLift}
      className="flex flex-col w-full max-w-lg mx-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {SCAFFOLD.title}
        </span>
        {step !== 'complete' && (
          <button
            onClick={onCancel}
            className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            {SCAFFOLD.steps.cancel}
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 px-4 py-2">
        {stepOrder
          .filter((s) => s !== 'scaffolding')
          .map((s, _i) => {
            const realIndex = stepOrder.indexOf(s);
            const active = realIndex === stepIndex;
            const done = realIndex < stepIndex;
            return (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  done
                    ? 'bg-[var(--color-accent)]'
                    : active
                    ? 'bg-[var(--color-accent)] opacity-60'
                    : 'bg-[var(--color-border)]'
                }`}
              />
            );
          })}
      </div>

      {/* Step label */}
      <div className="px-4 pb-1">
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {stepLabels[step]}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 pb-4 pt-2">
        {error && (
          <div className="mb-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'describe' && (
            <DescribeStep key="describe" onSubmit={handleDescribe} />
          )}
          {step === 'questions' && inferred && (
            <QuestionsStep
              key="questions"
              questions={questions}
              inferred={inferred}
              onSubmit={handleAnswers}
            />
          )}
          {step === 'preview' && (
            <PreviewStep
              key="preview"
              files={scaffoldFiles}
              projectName={projectName}
              onConfirm={handlePreviewConfirm}
            />
          )}
          {step === 'path' && (
            <PathStep
              key="path"
              defaultPath={defaultPath}
              projectName={projectName}
              onConfirm={handlePathConfirm}
            />
          )}
          {step === 'scaffolding' && <ScaffoldingStep key="scaffolding" />}
          {step === 'complete' && (
            <CompleteStep
              key="complete"
              projectId={completedProjectId}
              projectName={projectName}
              filesCreated={filesCreated}
              onViewProject={() => onComplete(completedProjectId)}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
