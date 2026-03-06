'use client';

/**
 * RecallCard — Sprint 27.0
 *
 * Ambient memory highlight card. Warm amber tint, hover-reveal actions.
 * Shown in ContextPanel when /api/recall/active returns an event.
 * Max 1 visible at a time — the card IS the surface.
 *
 * Design: subtle amber/gold tint at very low opacity.
 * Actions appear on hover only: Thanks / Not now / Remind me later.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn, cardLift } from '@/lib/design/animations';
import type { RecallEvent } from '@/lib/recall/types';

// ── Type icon map ──────────────────────────────────────────────────────────────

const TYPE_ICON: Record<RecallEvent['type'], string> = {
  file_revisit:           '📄',
  conversation_callback:  '💬',
  project_milestone:      '🏁',
  personal_moment:        '✨',
  work_anniversary:       '🎂',
  pattern_insight:        '🔮',
};

// ── Relative time helper ───────────────────────────────────────────────────────

function relativeTime(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 2)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const AMBER_BG    = 'rgba(255, 191, 36, 0.05)';
const AMBER_BORDER = 'rgba(255, 191, 36, 0.18)';
const AMBER_ACCENT = 'rgba(255, 191, 36, 0.80)';
const AMBER_DIM    = 'rgba(255, 191, 36, 0.40)';

// ── Component ─────────────────────────────────────────────────────────────────

interface RecallCardProps {
  event: RecallEvent;
  onAction: (eventId: string, action: 'appreciated' | 'dismissed' | 'snoozed') => Promise<void>;
}

export function RecallCard({ event, onAction }: RecallCardProps) {
  const [hovered, setHovered] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleAction = useCallback(
    async (action: 'appreciated' | 'dismissed' | 'snoozed') => {
      if (acting) return;
      setActing(action);
      try {
        await onAction(event.id, action);
        setDone(true);
      } catch {
        setActing(null);
      }
    },
    [acting, event.id, onAction],
  );

  return (
    <AnimatePresence mode="wait">
      {!done && (
        <motion.div
          key={event.id}
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.25 }}
          {...cardLift}
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          style={{
            background: AMBER_BG,
            border: `1px solid ${AMBER_BORDER}`,
            borderRadius: 8,
            padding: '10px 12px',
            cursor: 'default',
            position: 'relative',
          }}
        >
          {/* Amber left accent bar */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 8,
              bottom: 8,
              width: 3,
              borderRadius: '0 2px 2px 0',
              background: AMBER_ACCENT,
            }}
          />

          {/* Header: icon + source */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              paddingLeft: 8,
            }}
          >
            <span style={{ fontSize: 13 }}>{TYPE_ICON[event.type]}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: AMBER_DIM,
              }}
            >
              {event.source_name}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--mist)' }}>
              {relativeTime(event.created_at)}
            </span>
          </div>

          {/* Message */}
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--frost)',
              paddingLeft: 8,
            }}
          >
            {event.message}
          </p>

          {/* Hover-reveal action row */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                key="recall-actions"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                style={{
                  display: 'flex',
                  gap: 6,
                  marginTop: 10,
                  paddingLeft: 8,
                }}
              >
                <ActionButton
                  label="Thanks"
                  active={acting === 'appreciated'}
                  color={AMBER_ACCENT}
                  onClick={() => void handleAction('appreciated')}
                />
                <ActionButton
                  label="Not now"
                  active={acting === 'dismissed'}
                  color="var(--mist)"
                  onClick={() => void handleAction('dismissed')}
                />
                <ActionButton
                  label="Remind me later"
                  active={acting === 'snoozed'}
                  color="var(--frost)"
                  onClick={() => void handleAction('snoozed')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── ActionButton sub-component ────────────────────────────────────────────────

function ActionButton({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      style={{
        padding: '3px 8px',
        borderRadius: 4,
        border: `1px solid ${color}`,
        background: active ? color : 'transparent',
        color: active ? 'var(--deep-space)' : color,
        fontSize: 11,
        cursor: active ? 'wait' : 'pointer',
        opacity: active ? 0.7 : 1,
        transition: 'all 0.12s ease',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {active ? '…' : label}
    </button>
  );
}
