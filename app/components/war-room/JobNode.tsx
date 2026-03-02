/**
 * JobNode — SVG foreignObject node representing a single manifest.
 * Status drives background color via GregLite CSS variables.
 * Pulses briefly when status changes via CSS animation.
 * Sprint 2E — Dependency Graph UI
 */

'use client';

import { useEffect, useRef } from 'react';
import type { GraphNode, NodeStatus } from '@/lib/war-room/types';

function eosScoreColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
}

const STATUS_COLOR: Record<NodeStatus, string> = {
  pending:     'var(--shadow)',
  running:     'var(--cyan)',
  complete:    'var(--success)',
  partial:     'var(--warning)',
  failed:      'var(--error)',
  interrupted: 'var(--muted)',
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  pending:     'PENDING',
  running:     'RUNNING',
  complete:    'DONE',
  partial:     'PARTIAL',
  failed:      'FAILED',
  interrupted: 'STOPPED',
};

export interface JobNodeProps {
  node: GraphNode;
  position: { x: number; y: number };
  width: number;
  height: number;
  selected: boolean;
  onClick: () => void;
}

export function JobNode({ node, position, width, height, selected, onClick }: JobNodeProps) {
  const prevStatus = useRef(node.status);
  const foreignRef = useRef<SVGForeignObjectElement>(null);

  // Pulse animation on status change
  useEffect(() => {
    if (prevStatus.current !== node.status && foreignRef.current) {
      const el = foreignRef.current.querySelector('[data-pulse]');
      if (el) {
        el.classList.remove('war-room-pulse');
        // Force reflow so re-adding the class triggers the animation
        void (el as HTMLElement).offsetWidth;
        el.classList.add('war-room-pulse');
      }
    }
    prevStatus.current = node.status;
  }, [node.status]);

  const color = STATUS_COLOR[node.status];
  const x = position.x - width / 2;
  const y = position.y - height / 2;

  return (
    <foreignObject
      ref={foreignRef}
      x={x}
      y={y}
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
    >
      <div
        data-pulse
        onClick={onClick}
        className="war-room-node"
        style={{
          width,
          height,
          borderColor: selected ? color : 'var(--shadow)',
          boxShadow: selected ? `0 0 0 2px ${color}` : undefined,
        }}
        title={node.title}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        aria-label={`${node.title} — ${node.status}`}
      >
        {/* Status strip */}
        <div
          className="war-room-node-strip"
          style={{ background: color }}
          aria-hidden="true"
        />

        {/* Content */}
        <div className="war-room-node-content">
          <span className="war-room-node-title">{node.title}</span>
          <div className="flex items-center gap-1">
            {node.status === 'complete' && node.eosScore !== undefined && (
              <span
                className="war-room-node-eos"
                style={{ color: eosScoreColor(node.eosScore) }}
                title={`EoS health score: ${node.eosScore}/100`}
              >
                {node.eosScore}
              </span>
            )}
            <span className="war-room-node-badge" style={{ color }}>
              {STATUS_LABEL[node.status]}
            </span>
          </div>
        </div>
      </div>
    </foreignObject>
  );
}
