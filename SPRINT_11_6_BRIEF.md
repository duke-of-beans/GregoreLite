GREGLITE SPRINT 11.6 — Transit Map Phase E: Z1 Sankey View
Full conversation topology as a directed flow graph + zoom transitions | March 2026

YOUR ROLE: Build the Z1 Sankey view — a directed flow graph showing full conversation topology with token volume encoded as edge width, quality color coding on segments, and continuous zoom transitions between Z1 (Sankey) ↔ Z2 (Subway) ↔ Z3 (Detail). This is the final Transit Map sprint — it completes the three-zoom-level system described in TRANSIT_MAP_SPEC.md §1.1. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md (or STATUS_HEADER_UPDATE.md for latest state)
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\TRANSIT_MAP_SPEC.md — READ FULLY: §1.1 (Three Zoom Levels), §3.1 (Lines), §3.5 (Z1 Sankey Specifics), §3.6 (Z2 references for zoom target)
4. D:\Projects\GregLite\app\components\transit\SubwayMap.tsx — READ FULLY. Understand the SVG structure, indexToX(), extractBranchSegments(), props interface, layout constants. The Sankey must interop with this for zoom transitions.
5. D:\Projects\GregLite\app\lib\transit\stations.ts — station generation (Sankey nodes derive from same stations)
6. D:\Projects\GregLite\app\lib\transit\types.ts — EnrichedEvent, Station, EventTypeDefinition
7. D:\Projects\GregLite\app\lib\transit\registry.ts — marker configs (color for quality coding)
8. D:\Projects\GregLite\app\components\chat\ChatInterface.tsx — READ FULLY. Transit tab layout, shared transitEvents state, SubwayMap placement. The Sankey replaces or sits alongside the SubwayMap based on zoom level.
9. D:\Projects\GregLite\app\components\transit\SubwayStationNode.tsx — station rendering (zoom transition targets)
10. D:\Projects\GregLite\app\components\transit\SubwayBranch.tsx — branch rendering, BranchSegment interface
11. D:\Projects\GregLite\SPRINT_11_3_COMPLETE.md + review SPRINT_11_4_11_5_BRIEF.md — understand what was built and patterns established
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- D3's sankey layout is available via d3-sankey but it may be overkill for this use case. Evaluate whether a simpler custom layout (stations as nodes, message segments as links, width = token count) is sufficient before pulling in d3-sankey. d3 is already a dependency.
- Zoom transitions between Z1↔Z2 are the hardest part of this sprint. If smooth continuous zoom proves too complex (SVG coordinate system transformations + morphing between two different renderers), implement discrete transitions first (fade/crossfade between views) and note continuous zoom as a polish item.
- The Sankey and SubwayMap must share the same data source (transitEvents from ChatInterface). Do NOT create a separate fetch. The data transformation (events → sankey nodes/links) should be a pure function.
- If SVG performance degrades with >100 segments, consider switching to Canvas for the Sankey renderer. SVG is fine for <50 segments.
- Sonnet has failed on the same problem twice → spawn Opus subagent

EXISTING INFRASTRUCTURE:
- SubwayMap.tsx: full SVG renderer with indexToX(), extractBranchSegments(), station rendering, branch rendering, click-to-scroll. Lives in the Transit tab (25% top split).
- stations.ts: generateStations() produces Station[] from enriched events via registry config
- ChatInterface.tsx: shared transitEvents state, Transit tab with SubwayMap + messages split view
- d3 is already installed as a project dependency
- Registry has marker.color per event type for quality color coding
- conversation_events table has payload with token_count, model, latency_ms on flow.message events

FILE LOCATIONS (read before modifying):
  app/components/transit/SubwayMap.tsx              — Z2 renderer, zoom transition partner
  app/components/transit/SubwayStationNode.tsx      — station rendering
  app/components/transit/SubwayBranch.tsx           — branch segments
  app/components/chat/ChatInterface.tsx             — Transit tab layout, zoom state
  app/lib/transit/stations.ts                       — station generation
  app/lib/transit/types.ts                          — types to extend
  app/lib/transit/registry.ts                       — color configs

NEW FILES:
  app/lib/transit/sankey.ts                                    — Sankey data model (events → nodes + links)
  app/components/transit/SankeyView.tsx                         — SVG Sankey renderer
  app/components/transit/SankeySegment.tsx                      — individual segment (node) component
  app/components/transit/SankeyLink.tsx                         — flow link (edge) with width encoding
  app/components/transit/ZoomController.tsx                     — zoom level state + transition orchestrator
  app/lib/transit/__tests__/sankey.test.ts
  app/components/transit/__tests__/SankeyView.test.tsx

---

TASK 1: Sankey data model

New file: app/lib/transit/sankey.ts

Transform conversation events into a Sankey-compatible graph structure. Segments are groups of messages between stations. Links are flows between segments.

```typescript
interface SankeyNode {
  id: string;
  stationId: string | null;       // null for implicit segments (no station at boundary)
  label: string;                   // station name or "Messages N–M"
  messageIndexStart: number;
  messageIndexEnd: number;
  messageCount: number;
  tokenCount: number;              // sum of all flow.message token_count in this segment
  dominantModel: string;           // most-used model in this segment
  qualitySignal: 'positive' | 'neutral' | 'attention' | 'negative';  // from quality events
  branchId: string | null;         // null for main trunk
}

interface SankeyLink {
  sourceId: string;
  targetId: string;
  tokenVolume: number;             // drives edge width
  qualityColor: string;            // CSS variable from dominant quality signal
}

interface SankeyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalTokens: number;
  totalCost: number;
  totalMessages: number;
}

/**
 * Build a Sankey graph from conversation events and stations.
 * Pure function — no side effects, no DB reads.
 */
export function buildSankeyGraph(
  events: EnrichedEvent[],
  stations: Station[],
  totalMessages: number,
): SankeyGraph
```

Algorithm:
1. Sort stations by messageIndex
2. Create segments between consecutive stations (station[i] to station[i+1])
3. First segment: message 0 to first station. Last segment: last station to end.
4. For each segment, aggregate: sum token_count from flow.message events in that range, count messages, determine dominant model, assess quality signal
5. Quality signal per segment: check for quality.interruption (negative), quality.regeneration (attention), quality.copy_event (positive) — use the most severe signal present. No quality events = neutral.
6. Links connect consecutive segments. Link tokenVolume = segment tokenCount.
7. Branch segments: if flow.branch_fork events exist, create parallel segments at the fork point. Active branch continues in the main flow, abandoned branches get separate nodes with branchId set.

Quality color mapping (from TRANSIT_MAP_SPEC.md §3.2):
- positive → var(--green-400)
- neutral → var(--frost)
- attention → var(--amber-400)
- negative → var(--red-400)

Tests (sankey.test.ts):
- Builds correct segments from stations (3 stations → 4 segments)
- Token counts aggregated correctly per segment
- Quality signal reflects worst quality event in segment
- Branch fork creates parallel segments
- Empty conversation → single empty segment
- No stations → one big segment spanning full conversation
- Pure function: same inputs always produce same outputs

TASK 2: SankeyLink component

New file: app/components/transit/SankeyLink.tsx

Renders a single flow edge between two Sankey nodes. Width proportional to token volume.

```typescript
interface SankeyLinkProps {
  sourceX: number;
  sourceY: number;
  sourceHeight: number;     // vertical extent at source node
  targetX: number;
  targetY: number;
  targetHeight: number;
  color: string;            // CSS variable string
  opacity?: number;
  onClick?: () => void;
}
```

Render as an SVG <path> using cubic bezier curves. The path should be a smooth horizontal flow from source right edge to target left edge, with width (strokeWidth) proportional to the token volume. Use the same bezier curve pattern as SubwayBranch.tsx for visual consistency.

Minimum width: 2px (even for low-token segments). Maximum width: 40px. Scale linearly between min and max based on tokenVolume relative to max tokenVolume in the graph.

TASK 3: SankeySegment component

New file: app/components/transit/SankeySegment.tsx

Renders a single Sankey node (segment between stations).

```typescript
interface SankeySegmentProps {
  node: SankeyNode;
  x: number;
  y: number;
  width: number;
  height: number;           // proportional to messageCount or tokenCount
  qualityColor: string;
  isActive: boolean;        // main trunk vs abandoned branch
  onClick: () => void;
}
```

Render as a rounded rect with:
- Fill: qualityColor at 20% opacity (subtle background)
- Border: qualityColor at 80% opacity
- Label inside: node label (truncated if too long)
- Metrics below (on hover or always if space permits): message count, token count, dominant model
- Abandoned branches: gray fill, dashed border, 50% opacity

TASK 4: SankeyView renderer

New file: app/components/transit/SankeyView.tsx

The main Sankey visualization component.

```typescript
interface SankeyViewProps {
  events: EnrichedEvent[];
  totalMessages: number;
  height?: number;
  onSegmentClick: (node: SankeyNode) => void;  // zoom to Z2 centered on segment
  onForkClick?: (forkEventId: string) => void;  // highlight both branches
}
```

Layout:
1. Call buildSankeyGraph() to get nodes + links
2. Position nodes left-to-right by messageIndexStart / totalMessages (same proportional logic as SubwayMap's indexToX)
3. Node height proportional to tokenCount (min 30px, max 80px)
4. Main trunk nodes at center Y. Branch nodes offset above/below.
5. Render links between consecutive nodes using SankeyLink
6. Header bar: total session tokens, total cost, total messages

Interaction:
- Hover segment → tooltip with detailed metrics (message count, tokens, cost, model, quality events)
- Click segment → fires onSegmentClick (parent handles zoom to Z2)
- Click fork point → highlights both branches (flash animation)

SVG viewBox should be calculated from the graph dimensions. Add horizontal pan (drag) for wide conversations.

TASK 5: Zoom controller

New file: app/components/transit/ZoomController.tsx

Manages the zoom state and transitions between Z1 (Sankey), Z2 (Subway), Z3 (Detail/Messages).

```typescript
type ZoomLevel = 'Z1' | 'Z2' | 'Z3';

interface ZoomControllerProps {
  children: (props: {
    zoomLevel: ZoomLevel;
    setZoomLevel: (level: ZoomLevel) => void;
    zoomToSegment: (messageIndex: number) => void;  // Z1 → Z2 centered on segment
    zoomToMessage: (messageId: string) => void;      // Z2 → Z3 centered on message
  }) => React.ReactNode;
}
```

State:
- zoomLevel: 'Z1' | 'Z2' | 'Z3' — default Z2 (subway is the primary view per spec)
- focusIndex: number | null — which message index to center on after zoom transition

Keyboard shortcuts (from TRANSIT_MAP_SPEC.md §1.1):
- Cmd+0 → Z2 (reset to default)
- Cmd+- → zoom out (Z3 → Z2 → Z1)
- Cmd+= → zoom in (Z1 → Z2 → Z3)
Check KeyboardShortcuts.tsx for conflicts. Cmd+- and Cmd+= may conflict with browser zoom — if so, use Cmd+Shift+- and Cmd+Shift+= instead, or only bind when the Transit tab is active.

Transition approach:
- PREFERRED: Crossfade transition (opacity 1→0 on outgoing, 0→1 on incoming, 300ms). This is reliable and looks clean.
- STRETCH: Continuous zoom via SVG viewBox scaling. If the Sankey and Subway share the same coordinate system (both use indexToX with the same width), a viewBox zoom can smoothly transition between them. Only attempt this if crossfade works first.

TASK 6: Wire into ChatInterface

File: app/components/chat/ChatInterface.tsx

Replace the current Transit tab content with ZoomController:
1. Default view: Z2 (SubwayMap) — existing behavior preserved
2. Cmd+0 / Cmd+- / Cmd+= cycle between zoom levels
3. Z1 shows SankeyView in the Transit tab's top split
4. Z2 shows SubwayMap (existing)
5. Z3 hides the Transit map split and shows messages full-height (existing default when Transit tab is not focused, or metadata-only view)

Click flows:
- SankeyView segment click → setZoomLevel('Z2'), scroll SubwayMap to that segment's station range
- SubwayMap station click → already scrolls to message (existing). Optionally also setZoomLevel('Z3') if user double-clicks.
- Messages scroll → updates active station in SubwayMap (existing)

The Transit tab header could show a small zoom indicator: "Z1 · Z2 · Z3" with the active level highlighted. Clicking the indicator cycles zoom levels.

TASK 7: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. New tests:
   - sankey.ts: 7+ tests (segment generation, token aggregation, quality signals, branches, edge cases)
   - SankeyView: 3+ pure logic tests (layout calculations, link width scaling)
   - ZoomController: 3+ tests (zoom level transitions, keyboard shortcuts, focus preservation)
4. Update STATUS.md:
   - Header: Transit Map COMPLETE (all phases shipped)
   - Close Sprint 11.6
   - Next: product backlog triage or v1.1.1 tag
5. Update FEATURE_BACKLOG.md — mark Phase E as ✅ SHIPPED, update header to reflect Transit Map fully complete
6. Update SPRINT_ROADMAP.md execution summary — all sprints ✅ COMPLETE
7. Write SPRINT_11_6_COMPLETE.md
8. Commit: "feat: Sprint 11.6 — Transit Map Z1 Sankey view + zoom transitions (Transit Map complete)"
9. Push

---

QUALITY GATES:
 1. SankeyView renders segments as nodes with correct token volume encoding
 2. SankeyLink width proportional to token volume (min 2px, max 40px)
 3. Quality color coding correct per segment (green/frost/amber/red)
 4. Branch segments render at fork points (active vs abandoned visual distinction)
 5. Click segment → zooms to Z2 centered on that segment's station range
 6. Zoom transitions work: Z1↔Z2↔Z3 via keyboard shortcuts
 7. Cmd+0 resets to Z2 (default)
 8. Header metrics: total tokens, cost, messages displayed
 9. Hover tooltip shows segment details
10. Sankey coexists with SubwayMap — zoom controller switches between them
11. No regression in SubwayMap behavior (existing Z2 features preserved)
12. buildSankeyGraph() is a pure function — same inputs, same outputs
13. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Sankey uses SAME shared transitEvents data from ChatInterface — no separate fetch
3. buildSankeyGraph() must be a pure function (exported, testable, no side effects)
4. Quality colors from registry — do NOT hardcode color values in the renderer
5. Crossfade transitions first, continuous zoom only as stretch goal
6. Use cmd shell (not PowerShell)
7. Read SubwayMap.tsx and ChatInterface.tsx FULLY before modifying — understand existing layout
8. Minimum viable Sankey first (single trunk, token widths, quality colors), then add branches + zoom
9. If d3-sankey layout is needed, install it (d3 is already a dep). But evaluate custom layout first.

DOC SYNC NOTE:
Several doc files (FEATURE_BACKLOG.md, SPRINT_ROADMAP.md, PROJECT_DNA.yaml, STATUS.md) may need updating at commit time. Check for *_UPDATE.md files alongside the originals — those contain the latest content if the originals were locked during a prior sync pass. Apply those updates as part of your final commit if the files are now writable.
