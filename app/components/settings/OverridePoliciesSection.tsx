'use client';

/**
 * OverridePoliciesSection — Sprint 18.0
 *
 * Lists active decision gate override policies with delete controls.
 * Nested under Settings panel so David can review and revoke policies
 * created via the three-choice GatePanel UI.
 */

import { useCallback, useEffect, useState } from 'react';
import type { GateTrigger } from '@/lib/decision-gate';
import type { OverridePolicy } from '@/lib/decision-gate/override-policies';

const TRIGGER_LABELS: Record<GateTrigger, string> = {
  repeated_question: 'Recurring Topic',
  high_tradeoff_count: 'Complex Decision',
  multi_project_touch: 'Cross-Project Impact',
  sacred_principle_risk: 'Shortcut Detected',
  irreversible_action: 'Irreversible Action',
  large_build_estimate: 'Large Scope',
  contradicts_prior: 'Contradicts Prior',
  low_confidence: 'Low Confidence',
};

const SCOPE_LABELS: Record<OverridePolicy['scope'], string> = {
  once: 'Once',
  category: 'Always (contextual)',
  always: 'Never warn',
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function OverridePoliciesSection() {
  const [policies, setPolicies] = useState<OverridePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/decision-gate/policies');
      const data = await res.json() as { policies?: OverridePolicy[]; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to load'); return; }
      setPolicies(data.policies ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPolicies(); }, [fetchPolicies]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/decision-gate/policies/${id}`, { method: 'DELETE' });
      setPolicies((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('Failed to delete policy');
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    try {
      await fetch('/api/decision-gate/policies', { method: 'DELETE' });
      setPolicies([]);
    } catch {
      setError('Failed to reset policies');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--frost)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        Override Policies
      </h3>

      {error && (
        <p style={{ fontSize: 12, color: 'var(--red, #f87171)', marginBottom: 8 }}>{error}</p>
      )}

      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--mist)' }}>Loading…</p>
      ) : policies.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--mist)' }}>
          No active policies. Use the gate panel to create bypass rules.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {policies.map((policy) => (
            <div
              key={policy.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'var(--elevated)',
                borderRadius: 6,
                border: '1px solid var(--shadow)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ice-white)', fontWeight: 500 }}>
                  {TRIGGER_LABELS[policy.trigger_type] ?? policy.trigger_type}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 2 }}>
                  {SCOPE_LABELS[policy.scope]} · {formatDate(policy.created_at)}
                </div>
              </div>
              <button
                onClick={() => void handleDelete(policy.id)}
                title="Remove policy"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--mist)',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: '2px 6px',
                  borderRadius: 4,
                  flexShrink: 0,
                  marginLeft: 8,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red, #f87171)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--mist)'; }}
                aria-label={`Remove ${TRIGGER_LABELS[policy.trigger_type] ?? policy.trigger_type} policy`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {policies.length > 0 && (
        <button
          onClick={() => void handleReset()}
          disabled={resetting}
          style={{
            marginTop: 12,
            fontSize: 12,
            color: 'var(--mist)',
            background: 'none',
            border: '1px solid var(--shadow)',
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          {resetting ? 'Resetting…' : 'Reset all policies'}
        </button>
      )}
    </div>
  );
}
