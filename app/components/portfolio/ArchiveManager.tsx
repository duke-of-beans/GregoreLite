/**
 * ArchiveManager — Sprint 25.0
 *
 * Settings/detail panel for managing archived project originals.
 * Shows archive status, "Mark as verified" button, and strict deletion flow.
 *
 * GUARD: "Delete permanently" is only enabled after:
 *   1. User clicks "Mark as verified" (sets verified_by_user = 1 in DB)
 *   2. User types the project name exactly in the confirmation input
 *
 * All copy from ONBOARDING.archive in copy-templates.ts.
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, CheckCircle, Clock } from 'lucide-react';
import { ONBOARDING } from '@/lib/voice/copy-templates';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArchiveRecord {
  id: string;
  projectId: string;
  projectName: string;
  originalPath: string;
  archivePath: string;
  archivedAt: number;
  verifiedByUser: boolean;
  deletedAt: number | null;
}

interface ArchiveManagerProps {
  projectId?: string; // If provided, show only archives for this project
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  container: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  row: {
    background: 'var(--elevated)',
    border: '1px solid var(--shadow)',
    borderRadius: 8, padding: '12px 14px',
    display: 'flex', flexDirection: 'column' as const, gap: 6,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 13, fontWeight: 600, color: 'var(--ice-white)',
  },
  meta: { fontSize: 11, color: 'var(--mist)', fontFamily: 'monospace' },
  status: (verified: boolean) => ({
    fontSize: 11,
    color: verified ? 'var(--green, #4caf50)' : 'var(--amber, #f5a623)',
    display: 'flex', alignItems: 'center', gap: 4,
  }),
  btnRow: { display: 'flex', gap: 8, marginTop: 4 },
  verifyBtn: {
    background: 'none', border: '1px solid var(--green, #4caf50)',
    borderRadius: 6, padding: '5px 12px',
    fontSize: 11, color: 'var(--green, #4caf50)',
    cursor: 'pointer' as const,
  },
  deleteBtn: (enabled: boolean) => ({
    background: enabled ? 'rgba(220, 53, 69, 0.1)' : 'none',
    border: `1px solid ${enabled ? 'var(--error, #dc3545)' : 'var(--shadow)'}`,
    borderRadius: 6, padding: '5px 12px',
    fontSize: 11,
    color: enabled ? 'var(--error, #dc3545)' : 'var(--mist)',
    cursor: enabled ? 'pointer' as const : 'not-allowed' as const,
    display: 'flex', alignItems: 'center', gap: 4,
  }),
  modal: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modalBox: {
    background: 'var(--deep-space)',
    border: '1px solid var(--error, #dc3545)',
    borderRadius: 10, padding: '24px',
    maxWidth: 480, width: '90%',
    display: 'flex', flexDirection: 'column' as const, gap: 14,
  },
  modalTitle: {
    fontSize: 15, fontWeight: 700,
    color: 'var(--error, #dc3545)',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  modalBody: { fontSize: 13, color: 'var(--frost)', lineHeight: 1.6 },
  modalWarning: {
    fontSize: 12, color: 'var(--amber, #f5a623)',
    background: 'rgba(245, 166, 35, 0.08)',
    border: '1px solid rgba(245, 166, 35, 0.2)',
    borderRadius: 6, padding: '8px 12px',
  },
  confirmInput: {
    background: 'var(--surface)', border: '1px solid var(--shadow)',
    borderRadius: 6, padding: '8px 12px',
    fontSize: 13, color: 'var(--frost)', outline: 'none', width: '100%',
  },
  confirmLabel: { fontSize: 11, color: 'var(--mist)', marginBottom: 4 },
  modalBtnRow: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  cancelBtn: {
    background: 'none', border: '1px solid var(--shadow)',
    borderRadius: 6, padding: '8px 16px',
    fontSize: 12, color: 'var(--mist)', cursor: 'pointer' as const,
  },
  confirmDeleteBtn: (enabled: boolean) => ({
    background: enabled ? 'rgba(220, 53, 69, 0.15)' : 'none',
    border: `1px solid ${enabled ? 'var(--error, #dc3545)' : 'var(--shadow)'}`,
    borderRadius: 6, padding: '8px 16px',
    fontSize: 12, fontWeight: 600,
    color: enabled ? 'var(--error, #dc3545)' : 'var(--mist)',
    cursor: enabled ? 'pointer' as const : 'not-allowed' as const,
  }),
};

// ── DeleteModal ───────────────────────────────────────────────────────────────

interface DeleteModalProps {
  archive: ArchiveRecord;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

function DeleteModal({ archive, onConfirm, onCancel, deleting }: DeleteModalProps) {
  const [typed, setTyped] = useState('');
  const nameMatches = typed === archive.projectName;

  return (
    <div style={S.modal} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={S.modalBox}>
        <div style={S.modalTitle}>
          <AlertTriangle size={16} />
          {ONBOARDING.archive.modalTitle(archive.projectName)}
        </div>

        <p style={S.modalBody}>
          {ONBOARDING.archive.modalBody(archive.projectName, archive.archivePath)}
        </p>

        <div style={S.modalWarning}>
          {ONBOARDING.archive.modalResponsibility}
        </div>

        <div>
          <div style={S.confirmLabel}>
            {ONBOARDING.archive.typeToConfirm(archive.projectName)}
          </div>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={ONBOARDING.archive.typeToConfirmPlaceholder(archive.projectName)}
            style={S.confirmInput}
            autoFocus
          />
        </div>

        <div style={S.modalBtnRow}>
          <button style={S.cancelBtn} onClick={onCancel} disabled={deleting}>
            {ONBOARDING.migration.cancelBtn}
          </button>
          <button
            style={S.confirmDeleteBtn(nameMatches && !deleting)}
            onClick={nameMatches && !deleting ? onConfirm : undefined}
            disabled={!nameMatches || deleting}
            title={nameMatches ? undefined : ONBOARDING.archive.deleteConfirmBtnDisabled}
          >
            {deleting ? 'Deleting…' : ONBOARDING.archive.deleteConfirmBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ArchiveRow ────────────────────────────────────────────────────────────────

function ArchiveRow({ archive, onRefresh }: { archive: ArchiveRecord; onRefresh: () => void }) {
  const [verifying, setVerifying] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArchiveRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/portfolio/archive/${archive.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: true }),
      });
      const body = await res.json() as { success: boolean; error?: string };
      if (body.success) onRefresh();
      else setMessage(body.error ?? 'Verification failed');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Network error');
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/portfolio/archive/${archive.id}`, { method: 'DELETE' });
      const body = await res.json() as { success: boolean; error?: string };
      if (body.success) {
        setDeleteTarget(null);
        setMessage(ONBOARDING.archive.deleteSuccess);
        onRefresh();
      } else {
        setMessage(ONBOARDING.archive.deleteError(body.error ?? 'Unknown error'));
      }
    } catch (err) {
      setMessage(ONBOARDING.archive.deleteError(err instanceof Error ? err.message : 'Network error'));
    } finally {
      setDeleting(false);
    }
  };

  const archivedDate = new Date(archive.archivedAt).toLocaleDateString();

  return (
    <>
      <div style={S.row}>
        <div style={S.header}>
          {archive.projectName}
          <span style={{ fontSize: 10, color: 'var(--mist)', fontWeight: 400 }}>archived {archivedDate}</span>
        </div>
        <div style={S.meta}>{archive.archivePath}</div>
        <div style={S.status(archive.verifiedByUser)}>
          {archive.verifiedByUser
            ? <><CheckCircle size={11} />{ONBOARDING.archive.statusVerified}</>
            : <><Clock size={11} />{ONBOARDING.archive.status}</>
          }
        </div>
        <div style={S.btnRow}>
          {!archive.verifiedByUser && (
            <button style={S.verifyBtn} onClick={() => { void handleVerify(); }} disabled={verifying}>
              {verifying ? 'Marking…' : ONBOARDING.archive.markVerifiedBtn}
            </button>
          )}
          <button
            style={S.deleteBtn(archive.verifiedByUser)}
            onClick={archive.verifiedByUser ? () => setDeleteTarget(archive) : undefined}
            disabled={!archive.verifiedByUser}
            title={archive.verifiedByUser ? undefined : ONBOARDING.archive.deleteBtnDisabled}
          >
            <Trash2 size={11} />
            {ONBOARDING.archive.deleteBtn}
          </button>
        </div>
        {message && <p style={{ fontSize: 11, color: 'var(--mist)', margin: 0 }}>{message}</p>}
      </div>

      {deleteTarget && (
        <DeleteModal
          archive={deleteTarget}
          onConfirm={() => { void handleDelete(); }}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </>
  );
}

// ── ArchiveManager (main export) ──────────────────────────────────────────────

export function ArchiveManager({ projectId }: ArchiveManagerProps) {
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArchives = async () => {
    setLoading(true);
    try {
      const url = projectId
        ? `/api/portfolio/archive?projectId=${encodeURIComponent(projectId)}`
        : '/api/portfolio/archive';
      const res = await fetch(url);
      const body = await res.json() as { success: boolean; data?: ArchiveRecord[]; error?: string };
      if (body.success && body.data) setArchives(body.data.filter((a) => !a.deletedAt));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchArchives(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p style={{ fontSize: 12, color: 'var(--mist)' }}>Loading archives…</p>;
  if (archives.length === 0) return null;

  return (
    <div style={S.container}>
      {archives.map((a) => (
        <ArchiveRow key={a.id} archive={a} onRefresh={() => { void fetchArchives(); }} />
      ))}
    </div>
  );
}
