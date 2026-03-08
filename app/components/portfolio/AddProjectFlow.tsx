import { apiFetch } from '@/lib/api-client';
/**
 * AddProjectFlow — Sprint 25.0
 *
 * Full "Add Existing Project" flow in 5 steps:
 *   1. Path input
 *   2. Scanning animation
 *   3. OnboardingChat (Q&A + DNA preview + approval)
 *   4. Migration decision (in-place vs. copy, with dependency warnings)
 *   5. Completion
 *
 * Each step is a distinct view. Back button revisits previous steps.
 * Escape / X cancels and returns to dashboard.
 * All copy from ONBOARDING in copy-templates.ts.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, FolderOpen, Loader } from 'lucide-react';
import { ONBOARDING } from '@/lib/voice/copy-templates';
import { OnboardingChat } from './OnboardingChat';
import type {
  DirectoryScanResult,
  InferResult,
  OnboardingQuestion,
  ProjectDnaYaml,
  DependencyWarning,
} from '@/lib/portfolio/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'path' | 'scanning' | 'questions' | 'migration' | 'done';

interface AddProjectFlowProps {
  onComplete: () => void;
  onCancel: () => void;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200,
  },
  panel: {
    background: 'var(--deep-space)',
    border: '1px solid var(--shadow)',
    borderRadius: 12,
    width: '90%', maxWidth: 560,
    maxHeight: '80vh',
    display: 'flex', flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 16px',
    borderBottom: '1px solid var(--shadow)',
    flexShrink: 0,
  },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--ice-white)', flex: 1 },
  stepLabel: { fontSize: 11, color: 'var(--mist)' },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'var(--mist)', cursor: 'pointer' as const, padding: 4,
    display: 'flex', alignItems: 'center',
  },
  backBtn: {
    background: 'none', border: 'none',
    color: 'var(--mist)', cursor: 'pointer' as const, padding: 4,
    display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
  },
  body: { flex: 1, overflowY: 'auto' as const, padding: '20px 20px 16px' },
  label: { fontSize: 12, color: 'var(--mist)', marginBottom: 6, display: 'block' },
  pathInput: {
    width: '100%', boxSizing: 'border-box' as const,
    background: 'var(--surface)',
    border: '1px solid var(--shadow)',
    borderRadius: 6, padding: '9px 12px',
    fontSize: 13, color: 'var(--frost)', outline: 'none',
  },
  primaryBtn: (disabled: boolean) => ({
    background: disabled ? 'transparent' : 'rgba(0, 212, 232, 0.1)',
    border: '1px solid var(--cyan)', borderRadius: 6,
    padding: '9px 20px', fontSize: 13, fontWeight: 600,
    color: 'var(--cyan)',
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
    opacity: disabled ? 0.4 : 1,
  }),
  scanningCenter: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: '40px 0',
  },
  scanningText: { fontSize: 13, color: 'var(--mist)' },
  optionCard: (selected: boolean) => ({
    background: selected ? 'rgba(0, 212, 232, 0.06)' : 'var(--elevated)',
    border: `1px solid ${selected ? 'var(--cyan)' : 'var(--shadow)'}`,
    borderRadius: 8, padding: '12px 14px',
    cursor: 'pointer' as const,
    marginBottom: 10,
  }),
  optionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--ice-white)', marginBottom: 4 },
  optionDetail: { fontSize: 11, color: 'var(--mist)', lineHeight: 1.5 },
  warningBox: {
    background: 'rgba(245, 166, 35, 0.07)',
    border: '1px solid rgba(245, 166, 35, 0.25)',
    borderRadius: 8, padding: '10px 14px',
    marginTop: 12, marginBottom: 12,
  },
  warningItem: { fontSize: 11, color: 'var(--amber, #f5a623)', lineHeight: 1.6 },
  errorMsg: { fontSize: 12, color: 'var(--error, #dc3545)', marginTop: 8 },
  successBox: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: 14, padding: '40px 0', textAlign: 'center' as const,
  },
  successTitle: { fontSize: 15, fontWeight: 600, color: 'var(--ice-white)' },
  successSub: { fontSize: 12, color: 'var(--mist)', maxWidth: 360, lineHeight: 1.6 },
};

// ── Step: Path Input ──────────────────────────────────────────────────────────

function StepPath({ onNext }: { onNext: (p: string) => void }) {
  const [value, setValue] = useState('');
  const canNext = value.trim().length > 3;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={S.label}>Project folder path</label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && canNext) onNext(value.trim()); }}
        placeholder="D:\Projects\MyProject"
        style={S.pathInput}
        autoFocus
      />
      <div>
        <button
          style={S.primaryBtn(!canNext)}
          disabled={!canNext}
          onClick={() => { if (canNext) onNext(value.trim()); }}
        >
          Scan
        </button>
      </div>
    </div>
  );
}

// ── Step: Scanning ────────────────────────────────────────────────────────────

function StepScanning({ folderName }: { folderName: string }) {
  return (
    <div style={S.scanningCenter}>
      <Loader size={24} style={{ color: 'var(--cyan)', animation: 'spin 1s linear infinite' }} />
      <p style={S.scanningText}>{ONBOARDING.scan.scanning(folderName)}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Step: Migration Decision ──────────────────────────────────────────────────

interface MigrationDecisionProps {
  scan: DirectoryScanResult;
  dna: ProjectDnaYaml;
  projectName: string;
  answers: Record<string, string>;
  onComplete: (projectId: string, mode: 'inplace' | 'copy') => void;
}

function StepMigration({ scan, dna, projectName, answers, onComplete }: MigrationDecisionProps) {
  const [mode, setMode] = useState<'inplace' | 'copy'>('inplace');
  const [warnings, setWarnings] = useState<DependencyWarning[]>([]);
  const [warningsAcked, setWarningsAcked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch dependency warnings when copy is selected
  useEffect(() => {
    if (mode !== 'copy') return;
    void (async () => {
      try {
        const res = await apiFetch('/api/portfolio/scan-directory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: scan.path, warningsOnly: true }),
        });
        const body = await res.json() as { success: boolean; data?: { warnings: DependencyWarning[] } };
        if (body.success && body.data) {
          setWarnings(body.data.warnings);
          setWarningsAcked(body.data.warnings.length === 0);
        }
      } catch { setWarningsAcked(true); }
    })();
  }, [mode, scan.path]);

  const canProceed = mode === 'inplace' || (mode === 'copy' && warningsAcked);

  const handleProceed = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const destPath = mode === 'copy'
        ? scan.path.replace(/[\\/][^\\/]+$/, '') + '\\' + projectName.replace(/[^a-zA-Z0-9_-]/g, '_') + '_managed'
        : undefined;

      const res = await apiFetch('/api/portfolio/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: scan.path,
          destPath,
          inPlace: mode === 'inplace',
          dna: JSON.stringify(dna),
          projectName,
          answers,
        }),
      });
      const body = await res.json() as { success: boolean; data?: { id: string }; error?: string };
      if (body.success && body.data) {
        onComplete(body.data.id, mode);
      } else {
        setError(body.error ?? 'Migration failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ fontSize: 13, color: 'var(--frost)', marginBottom: 12 }}>
        {ONBOARDING.migration.decisionPrompt}
      </p>

      <div style={S.optionCard(mode === 'inplace')} onClick={() => setMode('inplace')}>
        <div style={S.optionTitle}>{ONBOARDING.migration.inPlaceLabel}</div>
        <div style={S.optionDetail}>{ONBOARDING.migration.inPlaceDetail}</div>
      </div>

      <div style={S.optionCard(mode === 'copy')} onClick={() => { setMode('copy'); setWarningsAcked(false); }}>
        <div style={S.optionTitle}>{ONBOARDING.migration.copyLabel}</div>
        <div style={S.optionDetail}>{ONBOARDING.migration.copyDetail}</div>
      </div>

      {mode === 'copy' && warnings.length > 0 && (
        <div style={S.warningBox}>
          <p style={{ ...S.warningItem, fontWeight: 600, marginBottom: 6 }}>
            {ONBOARDING.migration.warningsIntro(warnings.length)}
          </p>
          {warnings.map((w, i) => (
            <div key={i} style={S.warningItem}>· {w.detail}</div>
          ))}
          {!warningsAcked && (
            <button
              style={{ ...S.primaryBtn(false), marginTop: 10, fontSize: 11, padding: '6px 14px' }}
              onClick={() => setWarningsAcked(true)}
            >
              {ONBOARDING.migration.acknowledgeBtn}
            </button>
          )}
        </div>
      )}

      {error && <p style={S.errorMsg}>{error}</p>}

      <div style={{ marginTop: 8 }}>
        <button
          style={S.primaryBtn(!canProceed || submitting)}
          disabled={!canProceed || submitting}
          onClick={() => { void handleProceed(); }}
        >
          {submitting ? 'Setting up…' : 'Proceed'}
        </button>
      </div>
    </div>
  );
}

// ── Step: Done ────────────────────────────────────────────────────────────────

function StepDone({ projectName, mode, onViewProject }: { projectName: string; mode: 'inplace' | 'copy'; onViewProject: () => void }) {
  const msg = mode === 'inplace'
    ? ONBOARDING.completion.inPlaceDone(projectName)
    : ONBOARDING.completion.success(projectName);
  return (
    <div style={S.successBox}>
      <FolderOpen size={28} style={{ color: 'var(--cyan)' }} />
      <p style={S.successTitle}>{msg}</p>
      <button style={S.primaryBtn(false)} onClick={onViewProject}>
        {ONBOARDING.completion.viewProject}
      </button>
    </div>
  );
}

// ── Main AddProjectFlow ───────────────────────────────────────────────────────

export function AddProjectFlow({ onComplete, onCancel }: AddProjectFlowProps) {
  const [step, setStep] = useState<Step>('path');
  const [projectPath, setProjectPath] = useState('');
  const [scan, setScan] = useState<DirectoryScanResult | null>(null);
  const [inferred, setInferred] = useState<InferResult | null>(null);
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [approvedDna, setApprovedDna] = useState<ProjectDnaYaml | null>(null);
  const [approvedAnswers, setApprovedAnswers] = useState<Record<string, string>>({});
  const [projectName, setProjectName] = useState('');
  const [migrationMode, setMigrationMode] = useState<'inplace' | 'copy'>('inplace');
  const [flowStartTime] = useState(Date.now());

  // Escape key → cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  // Step 1 → 2+3: scan the directory
  const handlePathSubmit = useCallback(async (p: string) => {
    setProjectPath(p);
    setProjectName(p.split(/[\\/]/).pop() ?? '');
    setStep('scanning');
    try {
      const res = await apiFetch('/api/portfolio/scan-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: p }),
      });
      const body = await res.json() as {
        success: boolean;
        data?: { scan: DirectoryScanResult; inferred: InferResult; questions: OnboardingQuestion[] };
        error?: string;
      };
      if (body.success && body.data) {
        setScan(body.data.scan);
        setInferred(body.data.inferred);
        setQuestions(body.data.questions);
        setStep('questions');
      } else {
        // Scan failed — go back to path input with error
        setStep('path');
      }
    } catch {
      setStep('path');
    }
  }, []);

  // Step 3 → 4: DNA approved
  const handleDnaApproved = useCallback((dna: ProjectDnaYaml, answers: Record<string, string>, name: string) => {
    setApprovedDna(dna);
    setApprovedAnswers(answers);
    setProjectName(name);
    setStep('migration');
  }, []);

  // Step 4 → 5: migration complete
  const handleMigrationComplete = useCallback((_projectId: string, mode: 'inplace' | 'copy') => {
    setMigrationMode(mode);
    setStep('done');
    // Capture telemetry (fire-and-forget)
    if (inferred) {
      const durationSecs = Math.round((Date.now() - flowStartTime) / 1000);
      void apiFetch('/api/portfolio/migrate', {
        method: 'PUT', // telemetry endpoint
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType: inferred.type,
          questionsAsked: questions.map((q) => q.id),
          metricsConfigured: Object.keys(approvedDna?.metrics ?? {}),
          templateUsed: inferred.type,
          onboardingDurationSeconds: durationSecs,
        }),
      });
    }
  }, [inferred, questions, approvedDna, flowStartTime]);

  const handleReset = useCallback(() => {
    setStep('path');
    setProjectPath('');
    setScan(null);
    setInferred(null);
    setQuestions([]);
    setApprovedDna(null);
    setApprovedAnswers({});
    setProjectName('');
  }, []);

  const canGoBack = step === 'questions' || step === 'migration';
  const handleBack = () => {
    if (step === 'questions') setStep('path');
    else if (step === 'migration') setStep('questions');
  };

  const stepLabels: Record<Step, string> = {
    path:      ONBOARDING.steps.path,
    scanning:  ONBOARDING.steps.scanning,
    questions: ONBOARDING.steps.questions,
    migration: ONBOARDING.steps.migration,
    done:      ONBOARDING.steps.done,
  };

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={S.panel}>
        {/* Header */}
        <div style={S.header}>
          {canGoBack && (
            <button style={S.backBtn} onClick={handleBack}>
              <ChevronLeft size={14} /> Back
            </button>
          )}
          <span style={S.title}>Add Existing Project</span>
          <span style={S.stepLabel}>{stepLabels[step]}</span>
          <button style={S.closeBtn} onClick={onCancel} aria-label="Cancel">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {step === 'path' && <StepPath onNext={(p) => { void handlePathSubmit(p); }} />}

          {step === 'scanning' && (
            <StepScanning folderName={projectPath.split(/[\\/]/).pop() ?? projectPath} />
          )}

          {step === 'questions' && scan && inferred && (
            <OnboardingChat
              scan={scan}
              inferred={inferred}
              questions={questions}
              onApproved={handleDnaApproved}
              onReset={handleReset}
            />
          )}

          {step === 'migration' && scan && approvedDna && (
            <StepMigration
              scan={scan}
              dna={approvedDna}
              projectName={projectName}
              answers={approvedAnswers}
              onComplete={handleMigrationComplete}
            />
          )}

          {step === 'done' && (
            <StepDone
              projectName={projectName}
              mode={migrationMode}
              onViewProject={onComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
