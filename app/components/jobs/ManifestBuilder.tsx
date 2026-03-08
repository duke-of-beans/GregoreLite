import { apiFetch } from '@/lib/api-client';
/**
 * ManifestBuilder
 *
 * Form to create a TaskManifest from the strategic thread context.
 * Calls spawnJob() from the job store on submit — guarded by the
 * Already-Built Gate (Sprint 3F) before spawning.
 *
 * Sprint 9-07: Added template picker, save-as-template, initialValues prop.
 *
 * BLUEPRINT §4.3 + §5.4 (ManifestBuilder + Already-Built Gate)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useJobStore } from '@/lib/stores/job-store';
import { buildManifest } from '@/lib/agent-sdk/manifest';
import type { TaskManifest, TaskType } from '@/lib/agent-sdk/types';
import { checkBeforeManifest } from '@/lib/cross-context/gate';
import { recordOverride } from '@/lib/cross-context/override-tracker';
import { AlreadyBuiltModal } from '@/components/cross-context/AlreadyBuiltModal';
import { TemplatePickerPanel } from './TemplatePickerPanel';
import type { GateMatch } from '@/lib/cross-context/gate';

const TASK_TYPES: TaskType[] = ['code', 'test', 'docs', 'research', 'deploy', 'self_evolution'];

export interface TemplateInitialValues {
  task_type: TaskType;
  title: string;
  template_description: string;
  success_criteria: string[];
  project_path: string;
}

interface ManifestBuilderProps {
  /** Pre-populated from the active strategic thread */
  threadId: string;
  strategicThreadId: string;
  /** Called after successful spawn so parent can close the form */
  onSpawned?: (jobId: string, queued: boolean) => void;
  /** Pre-fill form from a template */
  initialValues?: TemplateInitialValues;
}

export function ManifestBuilder({ threadId, strategicThreadId, onSpawned, initialValues }: ManifestBuilderProps) {
  const { spawnJob, loading } = useJobStore();

  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.template_description ?? '');
  const [taskType, setTaskType] = useState<TaskType>(initialValues?.task_type ?? 'code');
  const [projectPath, setProjectPath] = useState(initialValues?.project_path ?? 'D:\\Projects\\GregLite');
  const [successCriteria, setSuccessCriteria] = useState(initialValues?.success_criteria?.join('\n') ?? '');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [saveTemplateMode, setSaveTemplateMode] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSaveMsg, setTemplateSaveMsg] = useState<string | null>(null);

  // Apply initialValues when they change (template selected externally)
  useEffect(() => {
    if (initialValues) {
      setTitle(initialValues.title);
      setDescription(initialValues.template_description);
      setTaskType(initialValues.task_type);
      setProjectPath(initialValues.project_path);
      setSuccessCriteria(initialValues.success_criteria.join('\n'));
    }
  }, [initialValues]);

  const handleSelectTemplate = useCallback((template: {
    task_type: TaskType; title: string; template_description: string;
    success_criteria: string[]; project_path: string; id: string;
  }) => {
    setTitle(template.title);
    setDescription(template.template_description);
    setTaskType(template.task_type);
    setProjectPath(template.project_path);
    setSuccessCriteria(template.success_criteria.join('\n'));
    void fetch(`/api/templates?use=${encodeURIComponent(template.id)}`);
  }, []);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!templateName.trim() || !title.trim()) return;
    const criteria = successCriteria.split('\n').map((s) => s.trim()).filter(Boolean);
    try {
      const res = await apiFetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          task_type: taskType,
          title: title.trim(),
          template_description: description.trim(),
          success_criteria: criteria.length > 0 ? criteria : ['Passes all tests'],
          project_path: projectPath.trim(),
        }),
      });
      if (res.ok) {
        setTemplateSaveMsg('Template saved!');
        setSaveTemplateMode(false);
        setTemplateName('');
        setTimeout(() => setTemplateSaveMsg(null), 2500);
      }
    } catch { /* best effort */ }
  }, [templateName, title, description, taskType, projectPath, successCriteria]);

  // Gate state (Sprint 3F)
  const [gateMatches, setGateMatches] = useState<GateMatch[]>([]);
  const [pendingManifest, setPendingManifest] = useState<TaskManifest | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const criteria = successCriteria
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!title.trim()) { setSubmitError('Title is required'); return; }
    if (!description.trim()) { setSubmitError('Description is required'); return; }
    if (criteria.length === 0) { setSubmitError('At least one success criterion is required'); return; }

    try {
      const manifest = buildManifest({
        threadId,
        strategicThreadId,
        taskType,
        title: title.trim(),
        description: description.trim(),
        successCriteria: criteria,
        projectPath: projectPath.trim() || 'D:\\Projects\\GregLite',
        dependencies: [],
      });

      // ── Already-Built Gate (Sprint 3F) ─────────────────────────────────────
      const gateResult = await checkBeforeManifest(manifest);
      if (gateResult.shouldIntercept) {
        setGateMatches(gateResult.matches);
        setPendingManifest(manifest);
        return; // Modal takes over
      }

      await doSpawn(manifest);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to spawn session');
    }
  }

  async function doSpawn(manifest: TaskManifest) {
    try {
      const result = await spawnJob(manifest);
      onSpawned?.(result.jobId, result.queued);
      // Reset form
      setTitle('');
      setDescription('');
      setSuccessCriteria('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to spawn session');
    }
  }

  function handleReuseAsBase(content: string) {
    // Pre-fill description with matched content as starting context
    setDescription(content);
    setGateMatches([]);
    setPendingManifest(null);
  }

  function handleContinueAnyway(chunkId: string) {
    recordOverride(chunkId);
    setGateMatches([]);
    if (pendingManifest) {
      void doSpawn(pendingManifest);
    }
    setPendingManifest(null);
  }

  function handleCloseGate() {
    setGateMatches([]);
    setPendingManifest(null);
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--frost)',
    fontSize: '12px',
    padding: '6px 8px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '10px',
    color: 'var(--mist)',
    marginBottom: '4px',
    letterSpacing: '0.06em',
  };

  return (
    <>
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--frost)', letterSpacing: '0.08em' }}>
          NEW WORKER SESSION
        </span>
        <button
          type="button"
          onClick={() => setTemplatePanelOpen((o) => !o)}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: '10px',
            padding: '2px 8px',
          }}
        >
          📋 Templates
        </button>
      </div>

      {/* Task type */}
      <div>
        <label style={labelStyle}>TASK TYPE</label>
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as TaskType)}
          style={{ ...fieldStyle, cursor: 'pointer' }}
        >
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label style={labelStyle}>TITLE</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Add error boundary to ChatInterface"
          style={fieldStyle}
          maxLength={200}
        />
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>DESCRIPTION</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What should the worker do?"
          rows={3}
          style={{ ...fieldStyle, resize: 'vertical', lineHeight: '1.4' }}
        />
      </div>

      {/* Project path */}
      <div>
        <label style={labelStyle}>PROJECT PATH</label>
        <input
          type="text"
          value={projectPath}
          onChange={(e) => setProjectPath(e.target.value)}
          style={fieldStyle}
        />
      </div>

      {/* Success criteria */}
      <div>
        <label style={labelStyle}>SUCCESS CRITERIA (one per line)</label>
        <textarea
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
          placeholder={`npx tsc --noEmit passes\npnpm test:run passes\nError boundary renders fallback UI`}
          rows={4}
          style={{ ...fieldStyle, resize: 'vertical', lineHeight: '1.4', fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}
        />
      </div>

      {/* Error */}
      {submitError && (
        <div style={{ fontSize: '11px', color: 'var(--error)' }}>{submitError}</div>
      )}

      {/* Template save success */}
      {templateSaveMsg && (
        <div style={{ fontSize: '11px', color: 'var(--accent)' }}>{templateSaveMsg}</div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            flex: 1,
            background: loading ? 'var(--surface)' : 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: '4px',
            color: loading ? 'var(--mist)' : 'var(--bg)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            padding: '8px 16px',
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? 'Spawning…' : 'Spawn Worker Session'}
        </button>

        {!saveTemplateMode ? (
          <button
            type="button"
            onClick={() => setSaveTemplateMode(true)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--mist)',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '8px 10px',
              whiteSpace: 'nowrap',
            }}
          >
            Save as Template
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              style={{ ...fieldStyle, width: '120px', fontSize: '10px' }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleSaveAsTemplate()}
              disabled={!templateName.trim()}
              style={{
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '3px',
                color: 'var(--bg)',
                cursor: templateName.trim() ? 'pointer' : 'not-allowed',
                fontSize: '10px',
                fontWeight: 600,
                padding: '4px 8px',
                opacity: templateName.trim() ? 1 : 0.5,
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setSaveTemplateMode(false); setTemplateName(''); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--mist)', fontSize: '12px', padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Template picker panel (right drawer) */}
      <TemplatePickerPanel
        open={templatePanelOpen}
        onClose={() => setTemplatePanelOpen(false)}
        onSelect={handleSelectTemplate}
      />
    </form>

    {/* Already-Built Gate modal (Sprint 3F) */}
    {gateMatches.length > 0 && (
      <AlreadyBuiltModal
        matches={gateMatches}
        proposedTitle={title}
        proposedDescription={description}
        onReuseAsBase={handleReuseAsBase}
        onContinue={handleContinueAnyway}
        onClose={handleCloseGate}
      />
    )}
    </>
  );
}
