/**
 * Sankey data model — Sprint 11.6 (Z1 Sankey View)
 *
 * Transforms conversation events + stations into a Sankey-compatible graph:
 * nodes (segments between stations) + links (flows between segments).
 *
 * Pure function. No side effects, no DB reads, no fetches.
 * Quality colors sourced from registry — zero hardcoded color values.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.5
 */

import type { EnrichedEvent, Station } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type QualitySignal = 'positive' | 'neutral' | 'attention' | 'negative';

export interface SankeyNode {
  id: string;
  stationId: string | null;
  label: string;
  messageIndexStart: number;
  messageIndexEnd: number;
  messageCount: number;
  tokenCount: number;
  dominantModel: string;
  qualitySignal: QualitySignal;
  branchId: string | null;
}

export interface SankeyLink {
  sourceId: string;
  targetId: string;
  tokenVolume: number;
  qualityColor: string;
}

export interface SankeyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalTokens: number;
  totalCost: number;
  totalMessages: number;
}

// ── Quality color mapping (from registry marker.color values §3.2) ────────────

const QUALITY_COLORS: Record<QualitySignal, string> = {
  positive:  'var(--green-400)',
  neutral:   'var(--frost)',
  attention: 'var(--amber-400)',
  negative:  'var(--red-400)',
};

export function getQualityColor(signal: QualitySignal): string {
  return QUALITY_COLORS[signal];
}

// ── Quality signal assessment ─────────────────────────────────────────────────

/** Map event_type to quality severity. Higher = worse. Negative = positive. */
function qualitySeverity(eventType: string): number {
  if (eventType === 'quality.interruption') return 3;
  if (eventType === 'quality.regeneration') return 2;
  if (eventType === 'quality.edit_resend') return 2;
  if (eventType === 'quality.immediate_followup') return 1;
  if (eventType === 'quality.copy_event') return -1;
  return 0;
}

function severityToSignal(severity: number): QualitySignal {
  if (severity >= 3) return 'negative';
  if (severity >= 2) return 'attention';
  if (severity < 0) return 'positive';
  return 'neutral';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDominantModel(events: EnrichedEvent[]): string {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== 'flow.message') continue;
    const model = String((e.payload as Record<string, unknown>)?.model ?? 'unknown');
    counts.set(model, (counts.get(model) ?? 0) + 1);
  }
  let best = 'unknown';
  let bestCount = 0;
  for (const [model, count] of counts) {
    if (count > bestCount) { best = model; bestCount = count; }
  }
  return best;
}

function sumTokens(events: EnrichedEvent[]): number {
  let total = 0;
  for (const e of events) {
    if (e.event_type !== 'flow.message') continue;
    const tc = (e.payload as Record<string, unknown>)?.token_count;
    if (typeof tc === 'number') total += tc;
  }
  return total;
}

function sumCost(events: EnrichedEvent[]): number {
  let total = 0;
  for (const e of events) {
    if (e.event_type !== 'flow.message') continue;
    const cost = (e.payload as Record<string, unknown>)?.cost_usd;
    if (typeof cost === 'number') total += cost;
  }
  return total;
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Build a Sankey graph from conversation events and stations.
 * Pure function — no side effects, no DB reads.
 */
export function buildSankeyGraph(
  events: EnrichedEvent[],
  stations: Station[],
  totalMessages: number,
): SankeyGraph {
  // Empty conversation → single empty segment
  if (totalMessages === 0 || events.length === 0) {
    return {
      nodes: [{
        id: 'seg-empty',
        stationId: null,
        label: 'Empty',
        messageIndexStart: 0,
        messageIndexEnd: 0,
        messageCount: 0,
        tokenCount: 0,
        dominantModel: 'unknown',
        qualitySignal: 'neutral',
        branchId: null,
      }],
      links: [],
      totalTokens: 0,
      totalCost: 0,
      totalMessages: 0,
    };
  }

  // Sort stations by message index
  const sorted = [...stations].sort((a, b) => a.messageIndex - b.messageIndex);

  // Build segment boundaries from stations
  const boundaries: number[] = [0];
  for (const s of sorted) {
    if (s.messageIndex > 0 && s.messageIndex < totalMessages) {
      boundaries.push(s.messageIndex);
    }
  }
  if (boundaries[boundaries.length - 1] !== totalMessages - 1) {
    boundaries.push(totalMessages - 1);
  }
  const uniqueBounds = [...new Set(boundaries)].sort((a, b) => a - b);

  // Build trunk nodes for each segment
  const nodes: SankeyNode[] = [];
  for (let i = 0; i < uniqueBounds.length - 1; i++) {
    const start = uniqueBounds[i]!;
    const end = uniqueBounds[i + 1]!;
    const segId = `seg-${i}`;

    const station = sorted.find((s) => s.messageIndex === start);

    const segEvents = events.filter((e) => {
      const idx = e.message_index ?? -1;
      return idx >= start && idx <= end;
    });

    // Quality signal: worst quality event in segment
    let worstSeverity = 0;
    for (const e of segEvents) {
      if (e.category === 'quality') {
        const sev = qualitySeverity(e.event_type);
        if (sev > worstSeverity) worstSeverity = sev;
        if (sev < 0 && worstSeverity === 0) worstSeverity = sev;
      }
    }

    nodes.push({
      id: segId,
      stationId: station?.id ?? null,
      label: station?.name ?? `Messages ${start}\u2013${end}`,
      messageIndexStart: start,
      messageIndexEnd: end,
      messageCount: end - start + 1,
      tokenCount: sumTokens(segEvents),
      dominantModel: getDominantModel(segEvents),
      qualitySignal: severityToSignal(worstSeverity),
      branchId: null,
    });
  }

  // Edge case: no segments created (single message)
  if (nodes.length === 0) {
    nodes.push({
      id: 'seg-0',
      stationId: null,
      label: `Messages 0\u2013${totalMessages - 1}`,
      messageIndexStart: 0,
      messageIndexEnd: totalMessages - 1,
      messageCount: totalMessages,
      tokenCount: sumTokens(events),
      dominantModel: getDominantModel(events),
      qualitySignal: 'neutral',
      branchId: null,
    });
  }

  // Branch nodes from fork events
  const forkEvents = events.filter((e) => e.event_type === 'flow.branch_fork');
  for (const fork of forkEvents) {
    const forkIdx = fork.message_index ?? 0;
    const isActive = (fork.payload as Record<string, unknown>)?.is_active === true;
    const branchType = String((fork.payload as Record<string, unknown>)?.branch_type ?? 'branch');
    const remaining = totalMessages - forkIdx;
    const endIdx = forkIdx + Math.max(2, Math.round(remaining * 0.15));
    const clampedEnd = Math.min(endIdx, totalMessages - 1);

    const branchEvents = events.filter((e) => {
      const idx = e.message_index ?? -1;
      return idx >= forkIdx && idx <= clampedEnd;
    });

    nodes.push({
      id: `branch-${fork.id}`,
      stationId: null,
      label: `Fork: ${branchType}`,
      messageIndexStart: forkIdx,
      messageIndexEnd: clampedEnd,
      messageCount: clampedEnd - forkIdx + 1,
      tokenCount: sumTokens(branchEvents),
      dominantModel: getDominantModel(branchEvents),
      qualitySignal: isActive ? 'neutral' : 'negative',
      branchId: fork.id,
    });
  }

  // Links between consecutive trunk nodes
  const links: SankeyLink[] = [];
  const trunkNodes = nodes.filter((n) => n.branchId === null);
  for (let i = 0; i < trunkNodes.length - 1; i++) {
    const source = trunkNodes[i]!;
    const target = trunkNodes[i + 1]!;
    links.push({
      sourceId: source.id,
      targetId: target.id,
      tokenVolume: source.tokenCount,
      qualityColor: getQualityColor(source.qualitySignal),
    });
  }

  // Links from trunk to branch nodes at fork points
  for (const node of nodes) {
    if (!node.branchId) continue;
    const parentTrunk = trunkNodes.find(
      (t) => node.messageIndexStart >= t.messageIndexStart && node.messageIndexStart <= t.messageIndexEnd,
    );
    if (parentTrunk) {
      links.push({
        sourceId: parentTrunk.id,
        targetId: node.id,
        tokenVolume: node.tokenCount,
        qualityColor: getQualityColor(node.qualitySignal),
      });
    }
  }

  return {
    nodes,
    links,
    totalTokens: sumTokens(events),
    totalCost: sumCost(events),
    totalMessages,
  };
}
