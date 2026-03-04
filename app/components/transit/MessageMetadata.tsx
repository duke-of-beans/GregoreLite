/**
 * MessageMetadata — Sprint 11.4 (Z3 Detail Annotations)
 *
 * Styled inline metadata row rendered below each assistant message
 * when the Transit Map annotation layer is visible.
 *
 * Data comes from the MessageProps already on the message (model, tokens,
 * costUsd, latencyMs) — NO additional fetch needed, these arrive via the
 * SSE `done` event and are stored on the MessageProps object.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.7
 */

'use client';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MessageMetadataProps {
  model?: string | undefined;
  /** Total tokens (input + output combined). Use when inputTokens is absent. */
  tokens?: number | undefined;
  /** Input tokens separately (shows "N in · M out" format when both present) */
  inputTokens?: number | undefined;
  /** Output tokens separately */
  outputTokens?: number | undefined;
  cost?: number | undefined;
  latencyMs?: number | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive short display name and color from a full model string */
export function parseModelLabel(model: string): { label: string; color: string } {
  const lower = model.toLowerCase();
  if (lower.includes('opus')) return { label: 'opus', color: 'var(--purple-400)' };
  if (lower.includes('haiku')) return { label: 'haiku', color: 'var(--green-400)' };
  if (lower.includes('sonnet')) return { label: 'sonnet', color: 'var(--cyan)' };
  // Fallback: use first meaningful segment after 'claude-'
  const stripped = model.replace(/^claude-?/i, '').split(/[-_]/)[0] ?? model;
  return { label: stripped.toLowerCase(), color: 'var(--frost)' };
}

/** Format token count as compact string with thousands separators */
export function formatTokens(input?: number, output?: number, total?: number): string | null {
  if (input !== undefined && output !== undefined) {
    return `${input.toLocaleString()} in · ${output.toLocaleString()} out`;
  }
  if (total !== undefined && total > 0) {
    return `${total.toLocaleString()} tokens`;
  }
  return null;
}

/** Format cost to 4 decimal places, omit if zero or undefined */
export function formatCost(cost?: number): string | null {
  if (cost === undefined || cost <= 0) return null;
  return `$${cost.toFixed(4)}`;
}

/** Format latency — ms below 1000, seconds above */
export function formatLatency(ms?: number): string | null {
  if (ms === undefined || ms <= 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MessageMetadata({
  model,
  tokens,
  inputTokens,
  outputTokens,
  cost,
  latencyMs,
}: MessageMetadataProps) {
  const tokenStr = formatTokens(inputTokens, outputTokens, tokens);
  const costStr = formatCost(cost);
  const latencyStr = formatLatency(latencyMs);
  const modelInfo = model ? parseModelLabel(model) : null;

  // Render nothing if all fields are absent
  const hasContent = modelInfo || tokenStr || costStr || latencyStr;
  if (!hasContent) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '8px',
        flexWrap: 'wrap',
      }}
    >
      {/* Model badge pill */}
      {modelInfo && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.03em',
            background: 'var(--elevated)',
            border: `1px solid ${modelInfo.color}`,
            color: modelInfo.color,
          }}
        >
          {modelInfo.label}
        </span>
      )}

      {/* Token counts */}
      {tokenStr && (
        <span style={{ fontSize: '10px', color: 'var(--mist)' }}>
          {tokenStr}
        </span>
      )}

      {/* Cost */}
      {costStr && (
        <>
          <span style={{ fontSize: '10px', color: 'var(--shadow)' }}>·</span>
          <span style={{ fontSize: '10px', color: 'var(--mist)' }}>{costStr}</span>
        </>
      )}

      {/* Latency */}
      {latencyStr && (
        <>
          <span style={{ fontSize: '10px', color: 'var(--shadow)' }}>·</span>
          <span style={{ fontSize: '10px', color: 'var(--mist)' }}>{latencyStr}</span>
        </>
      )}
    </div>
  );
}
