# GREGLITE — SPRINT 2E EXECUTION BRIEF
## War Room — Dependency Graph UI
**Instance:** Parallel Workstream E
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Phase 1 baseline:** TypeScript 0 errors, 24/24 tests, KERNL SQLite live at .kernl/greglite.db

---

## YOUR ROLE

Bounded execution worker. You are building the War Room — a live SVG dependency graph showing relationships between active worker sessions. This is mission control for parallel execution. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## DEPENDENCY NOTE — READ BEFORE STARTING

This sprint depends on Sprint 2A having committed its manifest schema. Before doing anything else:

```powershell
cd D:\Projects\GregLite
git log --oneline -10
```

Look for a commit containing `sprint-2a` that includes `app/lib/agent-sdk/types.ts`. If that commit exists, you have the `TaskManifest` and `JobState` types you need — proceed.

If Sprint 2A has not yet committed its types file, you have two options:
1. Check `D:\Projects\GregLite\SPRINT_2A_AgentSDK.md` and implement the `types.ts` stub yourself (just the interfaces, no implementation) so you can build against it
2. Build the War Room UI using mock data and wire it to real KERNL data once 2A types are committed

Either way, do not block — proceed with option 1 or 2 and note the decision in your completion report.

---

## MANDATORY BOOTSTRAP

Load in order before writing any code:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md`
7. `D:\Projects\GregLite\SPRINT_2E_WarRoom.md` — your complete spec
8. Check 2A types: `D:\Projects\GregLite\app\lib\agent-sdk\types.ts` (if it exists)

Then verify baseline:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Same fix applied 3+ times
- SVG layout algorithm produces overlapping nodes that can't be resolved in 2 attempts — fall back to `dagre` npm package immediately, do not keep fighting custom layout
- Operation estimated >8 minutes without a checkpoint
- TypeScript errors increase beyond baseline

Write a BLOCKED report with: what you were doing, what triggered the stop, what decision is needed.

---

## QUALITY GATES (ALL REQUIRED BEFORE COMMIT)

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. No mocks in production code (mock data in seed script only)
4. Every new module has at least one vitest test
5. STATUS.md updated
6. Conventional commit format

---

## WHAT YOU ARE BUILDING

### Install dependencies

```powershell
cd D:\Projects\GregLite\app
pnpm add dagre @types/dagre
```

Use `dagre` for layout — do not implement a custom DAG layout algorithm. The sprint blueprint mentioned implementing one, but dagre exists, is well-tested, and this is a LEAN-OUT call.

### New files

```
app/components/war-room/
  WarRoom.tsx              — main view, accessible via tab and Cmd+W
  DependencyGraph.tsx      — SVG graph with dagre layout
  JobNode.tsx              — SVG foreignObject node with status color
  JobEdge.tsx              — SVG path with arrowhead
  ManifestDetail.tsx       — sidebar panel on node click
  WarRoomEmpty.tsx         — empty state with CTA
  index.ts                 — exports

app/lib/war-room/
  graph-builder.ts         — builds GraphNode/GraphEdge from KERNL manifests table
  poller.ts                — polls KERNL every 5s, diffs against previous state
  types.ts                 — GraphNode, GraphEdge, WarRoomGraph interfaces
```

### Graph data types

```typescript
export interface GraphNode {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'complete' | 'partial' | 'failed' | 'interrupted';
  taskType: string;
  costUsd?: number;
  tokensUsed?: number;
  createdAt: number;
}

export interface GraphEdge {
  from: string;   // manifest_id that must complete first
  to: string;     // manifest_id that depends on `from`
}

export interface WarRoomGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

### Graph builder

Reads from KERNL `manifests` table. The `dependencies` column is a JSON string array of manifest IDs. Parse it for edges:

```typescript
export async function buildGraph(): Promise<WarRoomGraph> {
  const rows = await fetch('/api/kernl/manifests').then(r => r.json());

  const nodes: GraphNode[] = rows.map((row: any) => ({
    id: row.id,
    title: row.title ?? 'Untitled',
    status: row.status,
    taskType: row.task_type ?? 'unknown',
    costUsd: row.cost_usd,
    tokensUsed: row.tokens_used,
    createdAt: row.created_at,
  }));

  const edges: GraphEdge[] = [];
  for (const row of rows) {
    const deps: string[] = JSON.parse(row.dependencies ?? '[]');
    for (const dep of deps) {
      edges.push({ from: dep, to: row.id });
    }
  }

  return { nodes, edges };
}
```

If the `/api/kernl/manifests` endpoint doesn't exist yet, create it — it's a simple SELECT from the manifests table via the KERNL module.

### Dagre layout

```typescript
import dagre from 'dagre';

export function layoutGraph(graph: WarRoomGraph, nodeWidth = 180, nodeHeight = 60) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of graph.nodes) {
    const { x, y } = g.node(node.id);
    positions[node.id] = { x, y };
  }

  return positions;
}
```

### SVG rendering

```tsx
// DependencyGraph.tsx
<svg width={svgWidth} height={svgHeight}>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7"
      refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="var(--muted)" />
    </marker>
  </defs>
  {edges.map(edge => (
    <JobEdge key={`${edge.from}-${edge.to}`}
      from={positions[edge.from]}
      to={positions[edge.to]}
      nodeWidth={180} nodeHeight={60}
    />
  ))}
  {nodes.map(node => (
    <JobNode key={node.id}
      node={node}
      position={positions[node.id]}
      width={180} height={60}
      selected={selectedId === node.id}
      onClick={() => setSelectedId(node.id)}
    />
  ))}
</svg>
```

### Node colors (use GregLite CSS variables)

| Status | CSS Variable |
|--------|-------------|
| pending | `var(--shadow)` |
| running | `var(--cyan)` |
| complete | `var(--success)` |
| partial | `var(--warning)` |
| failed | `var(--error)` |
| interrupted | `var(--muted)` |

### Manifest detail sidebar

Clicking a node opens a right panel (or drawer) showing:
- Title + task type
- Status badge
- Success criteria (listed, not checked — we don't track per-criteria completion in Phase 2)
- Files modified (from `result_report` JSON if available)
- Token usage + cost
- Created at timestamp
- "Restart" button (only if failed or interrupted) — writes new manifest row with same spec, status SPAWNING

### Real-time polling

Poll every 5 seconds via `poller.ts`. Diff previous graph state against new — only re-render if nodes or edges changed. Animate status transitions: when a node's status changes, briefly pulse its border (CSS keyframe, 600ms).

```typescript
// poller.ts
export function startWarRoomPolling(onUpdate: (graph: WarRoomGraph) => void): () => void {
  let previous: WarRoomGraph = { nodes: [], edges: [] };

  const interval = setInterval(async () => {
    const next = await buildGraph();
    if (JSON.stringify(next) !== JSON.stringify(previous)) {
      previous = next;
      onUpdate(next);
    }
  }, 5000);

  return () => clearInterval(interval);
}
```

### Access

War Room is a tab in the main content area header:

```
│ [★ Strategic] [⚙ Workers] [🗺 War Room] +
```

Also accessible via Cmd+W — add to `app/components/ui/KeyboardShortcuts.tsx`.

### Seed data for testing

Write a seed script at `app/scripts/seed-manifests.ts` that creates 4–5 fake manifest rows with dependencies between them so you can test the graph layout without running real workers.

```typescript
// Creates a diamond dependency pattern:
//   A
//  / \
// B   C
//  \ /
//   D
```

---

## CHECKPOINTING

Every 3 file writes:
1. `npx tsc --noEmit`
2. `git add && git commit -m "sprint-2e(wip): [what you just did]"`

---

## SESSION END

When all gates pass:

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Update `D:\Projects\GregLite\STATUS.md` — mark Sprint 2E complete
4. Final commit: `git commit -m "sprint-2e: war room, dependency graph UI"`
5. `git push`
6. Write `SPRINT_2E_COMPLETE.md` to `D:\Projects\GregLite\` with: what was built, whether 2A types were available or stubbed, layout library decision (dagre), anything deferred

---

## GATES CHECKLIST

- [ ] War Room tab accessible from main nav
- [ ] Cmd+W opens War Room
- [ ] Empty state renders when manifests table is empty
- [ ] Seed manifests render as graph with correct dependency edges
- [ ] Diamond pattern (A→B, A→C, B→D, C→D) lays out correctly left-to-right
- [ ] Node colors reflect status
- [ ] Edges have arrowheads showing direction
- [ ] Clicking a node opens manifest detail panel
- [ ] Manifest detail shows title, status, cost, timestamps
- [ ] Graph polls every 5s and updates without full page re-render
- [ ] Status change triggers node pulse animation
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed

---

## ENVIRONMENT

- Project root: `D:\Projects\GregLite\`
- App dir: `D:\Projects\GregLite\app\`
- Package manager: pnpm
- KERNL DB: `D:\Projects\GregLite\app\.kernl\greglite.db`
- API key: already in `app\.env.local`
- Do NOT modify anything in `D:\Projects\Gregore\`
- Do NOT commit `.env.local`
- Layout library: dagre (do not build custom DAG layout)
