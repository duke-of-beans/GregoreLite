'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeIn } from '@/lib/design/animations';
import { ATTENTION } from '@/lib/voice/copy-templates';
import type { AttentionItem, AttentionSeverity } from '@/lib/portfolio/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttentionQueueProps {
  items: AttentionItem[];
  /** Called when user clicks a project name — scroll to that card */
  onProjectClick?: ((projectId: string) => void) | undefined;
  /** Called when user mutes an item — parent handles API call */
  onMute?: ((projectId: string, hours: number) => void) | undefined;
  /** Called when user dismisses an item from the queue */
  onDismiss?: ((projectId: string) => void) | undefined;
  className?: string | undefined;
}

// ─── Severity Dot ─────────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: AttentionSeverity }) {
  const colors: Record<AttentionSeverity, string> = {
    high: 'bg-red-500',
    medium: 'bg-amber-400',
    low: 'bg-blue-400',
  };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${colors[severity]}`}
      aria-label={severity}
    />
  );
}

// ─── Mute Menu ────────────────────────────────────────────────────────────────

const MUTE_OPTIONS = [
  { label: ATTENTION.mute.options.oneHour,    hours: 1   },
  { label: ATTENTION.mute.options.fourHours,  hours: 4   },
  { label: ATTENTION.mute.options.oneDay,     hours: 24  },
  { label: ATTENTION.mute.options.threeDays,  hours: 72  },
  { label: ATTENTION.mute.options.oneWeek,    hours: 168 },
];

function MuteMenu({
  onSelect,
  onClose,
}: {
  onSelect: (hours: number) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden"
    >
      {MUTE_OPTIONS.map((opt) => (
        <button
          key={opt.hours}
          onClick={() => {
            onSelect(opt.hours);
            onClose();
          }}
          className="w-full px-3 py-1.5 text-left text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] transition-colors"
        >
          {opt.label}
        </button>
      ))}
    </motion.div>
  );
}

// ─── Single Attention Row ─────────────────────────────────────────────────────

function AttentionRow({
  item,
  onProjectClick,
  onMute,
  onDismiss,
}: {
  item: AttentionItem;
  onProjectClick?: ((id: string) => void) | undefined;
  onMute?: ((id: string, hours: number) => void) | undefined;
  onDismiss?: ((id: string) => void) | undefined;
}) {
  const [muteOpen, setMuteOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-start gap-2.5 px-3 py-2 hover:bg-[var(--color-surface-raised)] transition-colors group"
    >
      {/* Severity indicator */}
      <span className="mt-1.5">
        <SeverityDot severity={item.severity} />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onProjectClick?.(item.projectId)}
          className="text-xs font-medium text-[var(--color-text-primary)] hover:underline truncate block max-w-full text-left"
        >
          {item.projectName}
        </button>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
          {item.reason}
        </p>
        {item.actionSuggestion && (
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            {item.actionSuggestion}
          </p>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative flex-shrink-0">
        {onMute && (
          <div className="relative">
            <button
              onClick={() => setMuteOpen((v) => !v)}
              title={ATTENTION.mute.label}
              className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              {/* Bell-off icon (inline SVG) */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 1l14 14M8 2a5 5 0 0 1 5 5v2l1 2H6" />
                <path d="M3 3a5 5 0 0 0-.5 2.5V10l-1 2h8.5" />
                <path d="M6.5 14a1.5 1.5 0 0 0 3 0" />
              </svg>
            </button>
            <AnimatePresence>
              {muteOpen && (
                <MuteMenu
                  onSelect={(hours) => onMute(item.projectId, hours)}
                  onClose={() => setMuteOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(item.projectId)}
            title={ATTENTION.dismiss.label}
            className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
          >
            {/* X icon */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AttentionQueue({
  items,
  onProjectClick,
  onMute,
  onDismiss,
  className = '',
}: AttentionQueueProps) {
  const [expanded, setExpanded] = useState(false);

  // Never render when there's nothing to show
  if (items.length === 0) return null;

  const highCount = items.filter((i) => i.severity === 'high').length;
  const label = ATTENTION.queue.summary(items.length, highCount);

  return (
    <motion.div
      {...fadeIn}
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden ${className}`}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--color-surface-raised)] transition-colors"
      >
        {/* Icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke={highCount > 0 ? '#ef4444' : '#f59e0b'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0"
        >
          <path d="M8 3a5 5 0 0 1 5 5v2l1 2H2l1-2V8a5 5 0 0 1 5-5z" />
          <path d="M6.5 14a1.5 1.5 0 0 0 3 0" />
        </svg>

        <span className="flex-1 text-left text-xs font-medium text-[var(--color-text-primary)]">
          {label}
        </span>

        {/* Severity chips */}
        <div className="flex items-center gap-1">
          {highCount > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-950 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
              {highCount} high
            </span>
          )}
        </div>

        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={`flex-shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </button>

      {/* Expanded list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]"
          >
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <AttentionRow
                  key={item.projectId}
                  item={item}
                  onProjectClick={onProjectClick}
                  onMute={onMute}
                  onDismiss={onDismiss}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
