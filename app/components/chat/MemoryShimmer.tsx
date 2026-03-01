/**
 * MemoryShimmer Component
 * 
 * Detects and highlights text that matches memories using semantic search.
 * Part of Phase 5.2 P2 - Memory System.
 * 
 * Spec: docs/UI_UX_FINAL_DIRECTION.md Part 4.1 (Inline Memory Discovery)
 * 
 * Usage:
 * <MemoryShimmer text={userInput} onMemoryClick={handleClick} />
 */

'use client';

import { useMemo } from 'react';

export interface MemoryMatch {
  id: string;
  text: string; // The matched text portion
  startIndex: number;
  endIndex: number;
  memoryId: string;
  memoryPreview: string;
  confidence: number; // 0-1
}

export interface MemoryShimmerProps {
  text: string;
  onMemoryClick?: (matches: MemoryMatch[]) => void;
  className?: string;
}

/**
 * MemoryShimmer Component
 * 
 * Renders text with shimmering highlights for memory matches.
 * When user clicks on shimmering text, triggers onMemoryClick with matched memories.
 */
export function MemoryShimmer({
  text,
  onMemoryClick,
  className = '',
}: MemoryShimmerProps) {
  // TODO: Replace with real semantic search
  // For now, this is a placeholder that detects common patterns
  const matches = useMemo(() => {
    return detectMemoryMatches(text);
  }, [text]);

  // If no matches, render plain text
  if (matches.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Render text with shimmering highlights
  const segments = buildTextSegments(text, matches);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'match') {
          return (
            <span
              key={index}
              className="memory-match cursor-pointer"
              onClick={() => onMemoryClick?.(segment.matches!)}
              title="Click to see related memories"
            >
              {segment.text}
            </span>
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </span>
  );
}

/**
 * Temporary placeholder for semantic search
 * TODO: Replace with PARALLAX integration (lib/aot/parallax/)
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
        confidence: 0.8, // Placeholder
      });
    }
  }

  return matches;
}

/**
 * Build text segments with match/no-match regions
 */
interface TextSegment {
  type: 'text' | 'match';
  text: string;
  matches?: MemoryMatch[];
}

function buildTextSegments(text: string, matches: MemoryMatch[]): TextSegment[] {
  if (matches.length === 0) {
    return [{ type: 'text', text }];
  }

  // Sort matches by start index
  const sortedMatches = [...matches].sort((a, b) => a.startIndex - b.startIndex);

  const segments: TextSegment[] = [];
  let currentIndex = 0;

  for (const match of sortedMatches) {
    // Add text before match
    if (currentIndex < match.startIndex) {
      segments.push({
        type: 'text',
        text: text.slice(currentIndex, match.startIndex),
      });
    }

    // Add match
    segments.push({
      type: 'match',
      text: match.text,
      matches: [match], // Could have multiple overlapping matches
    });

    currentIndex = match.endIndex;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    segments.push({
      type: 'text',
      text: text.slice(currentIndex),
    });
  }

  return segments;
}
