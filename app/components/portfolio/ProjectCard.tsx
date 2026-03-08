'use client';
/**
 * ProjectCard — Sprint 24.0
 *
 * Displays a single project in the Portfolio Dashboard grid.
 * Click fires onSelect(projectId) — parent handles detail panel.
 * Hover: cardLift animation (Framer Motion).
 * Health dot with tooltip.
 * Type badge colored pill.
 *
 * Responsive: handled by parent grid (3/2/1 columns).
 */


import { motion } from 'framer-motion';
import { cardLift } from '@/lib/design/animations';
import { formatRelativeTime } from '@/lib/voice/copy-templates';
import type { ProjectCard as ProjectCardData, ProjectHealth, ProjectType, AttentionSeverity } from '@/lib/portfolio/types';

// ── Type badge colors ─────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ProjectType, { bg: string; text: string }> = {
  code:     { bg: 'rgba(0, 212, 232, 0.12)',  text: 'var(--cyan)'    },
  research: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa'        },
  business: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24'        },
  creative: { bg: 'rgba(34, 197, 94, 0.15)',  text: '#4ade80'        },
  custom:   { bg: 'rgba(100, 116, 139, 0.15)',text: 'var(--mist)'    },
};

// ── Health dot ────────────────────────────────────────────────────────────────

const HEALTH_COLORS: Record<ProjectHealth, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red:   '#ef4444',
};

interface HealthDotProps {
  health: ProjectHealth;
  reason: string;
  attentionSeverity?: AttentionSeverity | undefined;
}

// Attention overrides the dot color to amber/red and adds a pulse animation
const ATTENTION_DOT_COLOR: Record<AttentionSeverity, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#60a5fa',
};

function HealthDot({ health, reason, attentionSeverity }: HealthDotProps) {
  const color = attentionSeverity
    ? ATTENTION_DOT_COLOR[attentionSeverity]
    : HEALTH_COLORS[health];
  const pulse = attentionSeverity === 'high' || attentionSeverity === 'medium';

  return (
    <span
      title={reason}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 8,
        height: 8,
        flexShrink: 0,
        cursor: 'help',
      }}
      aria-label={`Health: ${health} — ${reason}`}
    >
      {/* Pulse ring for attention */}
      {pulse && (
        <span
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            opacity: 0.6,
            animation: 'attentionPulse 2s ease-in-out infinite',
          }}
        />
      )}
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}88`,
        }}
      />
    </span>
  );
}

// ── TypeBadge ─────────────────────────────────────────────────────────────────

interface TypeBadgeProps {
  type: ProjectType;
  label: string;
}

function TypeBadge({ type, label }: TypeBadgeProps) {
  const colors = TYPE_COLORS[type];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: colors.bg,
        color: colors.text,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

// Attention border glow colors
const ATTENTION_GLOW: Record<AttentionSeverity, string> = {
  high:   'rgba(239, 68, 68, 0.45)',
  medium: 'rgba(245, 158, 11, 0.35)',
  low:    'rgba(96, 165, 250, 0.25)',
};
const ATTENTION_BORDER: Record<AttentionSeverity, string> = {
  high:   'rgba(239, 68, 68, 0.6)',
  medium: 'rgba(245, 158, 11, 0.5)',
  low:    'rgba(96, 165, 250, 0.4)',
};

interface ProjectCardProps {
  project: ProjectCardData;
  onSelect: (id: string) => void;
  /** Passed by PortfolioDashboard when this project appears in the attention queue */
  attentionSeverity?: AttentionSeverity | undefined;
}

export function ProjectCard({ project, onSelect, attentionSeverity }: ProjectCardProps) {
  const relTime = formatRelativeTime(project.lastActivity);

  const borderColor = attentionSeverity
    ? ATTENTION_BORDER[attentionSeverity]
    : 'var(--shadow)';
  const boxShadow = attentionSeverity
    ? `0 0 0 1px ${ATTENTION_BORDER[attentionSeverity]}, 0 0 14px ${ATTENTION_GLOW[attentionSeverity]}`
    : undefined;

  return (
    <motion.div
      {...cardLift}
      onClick={() => onSelect(project.id)}
      style={{
        background: 'var(--elevated)',
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        userSelect: 'none',
        boxShadow,
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${project.name}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(project.id); }}
    >
      {/* Row 1: name + health dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <span
          style={{
            color: 'var(--ice-white)',
            fontSize: 14,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
          title={project.name}
        >
          {project.name}
        </span>
        <HealthDot
          health={project.health}
          reason={project.healthReason}
          attentionSeverity={attentionSeverity}
        />
      </div>

      {/* Row 2: type badge + last activity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <TypeBadge type={project.type} label={project.typeLabel} />
        <span style={{ fontSize: 11, color: 'var(--mist)', flexShrink: 0 }}>
          {relTime}
        </span>
      </div>

      {/* Row 3: phase */}
      {project.phase && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--frost)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={project.phase}
        >
          {project.phase}
        </p>
      )}

      {/* Row 4: next action */}
      {project.nextAction && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--mist)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            borderTop: '1px solid var(--shadow)',
            paddingTop: 6,
          }}
          title={project.nextAction}
        >
          → {project.nextAction}
        </p>
      )}
    </motion.div>
  );
}
