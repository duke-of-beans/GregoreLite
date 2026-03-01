/**
 * MemoryIndicator Component
 * 
 * Shows when memories are detected in user input.
 * Part of Phase 5.2 P2 - Memory System.
 * 
 * Displays subtle indicator that can be clicked to view matching memories.
 */

'use client';

import { useEffect, useState } from 'react';
import type { MemoryMatch } from './MemoryShimmer';

export interface MemoryIndicatorProps {
  text: string;
  onMemoryClick?: (matches: MemoryMatch[]) => void;
}

export function MemoryIndicator({ text, onMemoryClick }: MemoryIndicatorProps) {
  const [matches, setMatches] = useState<MemoryMatch[]>([]);

  useEffect(() => {
    // Detect memory matches (placeholder implementation)
    const detected = detectMemoryMatches(text);
    setMatches(detected);
  }, [text]);

  if (matches.length === 0) return null;

  const handleClick = () => {
    onMemoryClick?.(matches);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 rounded-md bg-[var(--cyan)]/10 px-3 py-1.5 text-xs text-[var(--cyan)] transition-all hover:bg-[var(--cyan)]/20 hover:scale-105"
      title="Click to see related memories"
    >
      <svg
        className="h-4 w-4 shimmer"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      <span>
        {matches.length} {matches.length === 1 ? 'memory' : 'memories'} found
      </span>
      <span className="text-[var(--mist)]">• Click to view</span>
    </button>
  );
}

/**
 * Temporary placeholder for semantic search
 * TODO: Replace with PARALLAX integration
 */
function detectMemoryMatches(text: string): MemoryMatch[] {
  const matches: MemoryMatch[] = [];
  const lowerText = text.toLowerCase();

  // Placeholder patterns - will be replaced with semantic search
  const patterns = [
    { pattern: 'project', memory: 'Knowledge management system discussion', id: 'mem_1' },
    { pattern: 'layout', memory: 'Project layout wireframes', id: 'mem_2' },
    { pattern: 'design', memory: 'Design system requirements', id: 'mem_3' },
    { pattern: 'system', memory: 'System architecture planning', id: 'mem_4' },
    { pattern: 'memory', memory: 'Memory system implementation notes', id: 'mem_5' },
  ];

  for (const { pattern, memory, id } of patterns) {
    const index = lowerText.indexOf(pattern);
    if (index !== -1) {
      matches.push({
        id: `match_${id}_${index}`,
        text: text.slice(index, index + pattern.length),
        startIndex: index,
        endIndex: index + pattern.length,
        memoryId: id,
        memoryPreview: memory,
        confidence: 0.8,
      });
    }
  }

  return matches;
}
