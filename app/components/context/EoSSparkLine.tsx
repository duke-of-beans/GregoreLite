/**
 * EoSSparkLine — Sprint S9-09
 *
 * 80px × 24px SVG line chart showing last 30 EoS health scores.
 * Color: green ≥80, amber 60-79, red <60 (based on current score).
 * Shows current score + delta vs previous scan as text.
 * Click opens EoSHistoryPanel.
 *
 * Falls back to plain score text when < 2 data points.
 */

'use client';

import { useState, useEffect } from 'react';

interface SparkDataPoint {
  health_score: number;
  created_at: string;
}

interface EoSSparkLineProps {
  projectId: string;
  currentScore: number;
  onOpenHistory: () => void;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--success, #22c55e)';
  if (score >= 60) return 'var(--warning, #f59e0b)';
  return 'var(--error, #ef4444)';
}

export function EoSSparkLine({ projectId, currentScore, onOpenHistory }: EoSSparkLineProps) {
  const [points, setPoints] = useState<SparkDataPoint[]>([]);

  useEffect(() => {
    if (!projectId) return;

    fetch(`/api/eos/history?projectId=${encodeURIComponent(projectId)}&limit=30`)
      .then((res) => res.json())
      .then((body) => {
        // API returns DESC; reverse to chronological for chart
        const rows = (body.data as SparkDataPoint[]) ?? [];
        setPoints(rows.reverse());
      })
      .catch(() => setPoints([]));
  }, [projectId]);

  // Not enough data for a sparkline
  if (points.length < 2) {
    return (
      <span
        className="text-[11px] font-medium tabular-nums"
        style={{ color: scoreColor(currentScore) }}
      >
        {currentScore}/100
      </span>
    );
  }

  // Delta calculation
  const prev = points[points.length - 2];
  const delta = prev ? Math.round(currentScore - prev.health_score) : 0;
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
  const color = scoreColor(currentScore);

  // SVG sparkline: normalize scores 0-100 into 24px height, 80px width
  const w = 80;
  const h = 24;
  const padding = 2;
  const innerW = w - padding * 2;
  const innerH = h - padding * 2;
  const step = innerW / (points.length - 1);

  const pathData = points
    .map((p, i) => {
      const x = padding + i * step;
      const y = padding + innerH - (p.health_score / 100) * innerH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <button
      onClick={onOpenHistory}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
      title="Click to view EoS scan history"
      aria-label={`Health score ${currentScore}, delta ${deltaStr}. Click for history.`}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ flexShrink: 0 }}
      >
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current score dot */}
        <circle
          cx={padding + (points.length - 1) * step}
          cy={padding + innerH - (currentScore / 100) * innerH}
          r="2"
          fill={color}
        />
      </svg>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          color,
          whiteSpace: 'nowrap',
        }}
      >
        {currentScore}
        <span style={{ fontSize: '9px', marginLeft: '2px', opacity: 0.8 }}>
          ({deltaStr})
        </span>
      </span>
    </button>
  );
}
