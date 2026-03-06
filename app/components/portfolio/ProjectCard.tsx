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

'use client';

import { motion } from 'framer-motion';
import { cardLift } from '@/lib/design/animations';
import { formatRelativeTime } from '@/lib/voice/copy-templates';
import type { ProjectCard as ProjectCardData, ProjectHealth, ProjectType } from '@/lib/portfolio/types';

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
}

function HealthDot({ health, reason }: HealthDotProps) {
  return (
    <span
      title={reason}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: HEALTH_COLORS[health],
        flexShrink: 0,
        boxShadow: `0 0 6px ${HEALTH_COLORS[health]}88`,
        cursor: 'help',
      }}
      aria-label={`Health: ${health} — ${reason}`}
    />
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

interface ProjectCardProps {
  project: ProjectCardData;
  onSelect: (id: string) => void;
}

export function ProjectCard({ project, onSelect }: ProjectCardProps) {
  const relTime = formatRelativeTime(project.lastActivity);

  return (
    <motion.div
      {...cardLift}
      onClick={() => onSelect(project.id)}
      style={{
        background: 'var(--elevated)',
        border: '1px solid var(--shadow)',
        borderRadius: 8,
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        userSelect: 'none',
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
        <HealthDot health={project.health} reason={project.healthReason} />
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
