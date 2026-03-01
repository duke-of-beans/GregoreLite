/**
 * ManifestBuilder
 *
 * Form to create a TaskManifest from the strategic thread context.
 * Calls spawnJob() from the job store on submit — guarded by the
 * Already-Built Gate (Sprint 3F) before spawning.
 *
 * BLUEPRINT §4.3 + §5.4 (ManifestBuilder + Already-Built Gate)
 */

'use client';

import { useState } from 'react';
import { useJobStore } from '@/lib/stores/job-store';
import { buildManifest } from '@/lib/agent-sdk/manifest';
import type { TaskManifest, TaskType } from '@/lib/agent-sdk/types';
import { checkBeforeManifest } from '@/lib/cross-context/gate';
import { recordOverride } from '@/lib/cross-context/override-tracker';
import { AlreadyBuiltModal } from '@/components/cross-context/AlreadyBuiltModal';
import type { GateMatch } from '@/lib/cross-context/gate';

const TASK_TYPES: TaskType[] = ['code', 'test', 'docs', 'research', 'deploy', 'self_evolution'];

interface ManifestBuilderProps {
  /** Pre-populated from the active strategic thread */
  threadId: string;
  strategicThreadId: string;
  /** Called after successful spawn so parent can close the form */
  onSpawned?: (jobId: string, queued: boolean) => void;
}

export function ManifestBuilder({ threadId, strategicThreadId, onSpawned }: ManifestBuilderProps) {
  const { spawnJob, loading } = useJobStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('code');
  const [projectPath, setProjectPath] = useState('D:\\Projects\\GregLite');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--frost)',
          letterSpacing: '0.08em',
          marginBottom: '4px',
        }}
      >
        NEW WORKER SESSION
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

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        style={{
          background: loading ? 'var(--surface)' : 'var(--accent)',
          border: '1px solid var(--accent)',
          borderRadius: '4px',
          color: loading ? 'var(--mist)' : 'var(--bg)',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          padding: '8px 16px',
          width: '100%',
          transition: 'opacity 0.15s',
        }}
      >
        {loading ? 'Spawning…' : 'Spawn Worker Session'}
      </button>
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
