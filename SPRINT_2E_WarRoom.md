# SPRINT 2E — War Room Foundation
## GregLite Phase 2 | Parallel Workstream E
**Status:** READY TO QUEUE (after Phase 1 complete + 2A manifest schema defined)  
**Depends on:** Phase 1 complete. 2A must define manifest schema before 2E builds dependency UI.  
**Parallel with:** 2A, 2B, 2C, 2D (start after 2A manifest schema committed, not after 2A fully complete)  
**Estimated sessions:** 2–3

---

## OBJECTIVE

Build the War Room — a visual dependency graph showing relationships between active worker sessions. When Sprint 2A builds a manifest with `dependencies: ["manifest_id_1"]`, War Room shows which jobs block which. This is the "mission control" view for parallel execution.

**Success criteria:**
- War Room accessible via tab or keyboard shortcut (Cmd+W)
- All active/pending manifests rendered as nodes
- Dependency relationships rendered as directional edges
- Node color = job status (pending/running/complete/failed)
- Clicking a node shows manifest detail sidebar
- Dependency graph updates in real time as job statuses change
- Empty state: "No active jobs" with CTA to create one

---

## NEW FILES TO CREATE

```
app/components/war-room/
  WarRoom.tsx              — main War Room view
  DependencyGraph.tsx      — canvas/SVG graph renderer
  JobNode.tsx              — single node in graph
  JobEdge.tsx              — directional edge between nodes
  ManifestDetail.tsx       — sidebar on node click
  WarRoomEmpty.tsx         — empty state
  index.ts                 — exports

app/lib/war-room/
  graph-builder.ts         — builds graph data structure from KERNL manifests
  layout.ts                — simple DAG layout algorithm
  types.ts                 — GraphNode, GraphEdge, WarRoomState interfaces
  poller.ts                — polls KERNL every 5s for manifest updates
```

---

## GRAPH DATA STRUCTURE

```typescript
interface GraphNode {
  id: string;           // manifest_id
  title: string;
  status: 'pending' | 'running' | 'complete' | 'partial' | 'failed' | 'interrupted';
  taskType: string;
  costUsd?: number;
  tokensUsed?: number;
  createdAt: number;
}

interface GraphEdge {
  from: string;         // manifest_id that must complete first
  to: string;           // manifest_id that depends on `from`
}

interface WarRoomGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

Build from KERNL manifests table — read `dependencies` JSON array field for edges.

---

## LAYOUT ALGORITHM

Use a simple left-to-right DAG layout for Phase 2. No need for a full graph library — implement a basic topological sort + column assignment:

1. Topological sort of nodes
2. Assign each node to a column (its longest dependency path)
3. Arrange nodes in columns top-to-bottom
4. Draw edges as bezier curves between node positions

If this gets complex, fall back to `d3-dag` or `dagre` npm package. Check availability before implementing custom.

---

## RENDERING

Use SVG for the graph — no canvas, simpler to animate and interact with. Each node is an SVG `<foreignObject>` containing a styled div. Edges are SVG `<path>` elements with arrowheads.

```typescript
// Simple SVG approach
<svg width={width} height={height}>
  {edges.map(edge => (
    <JobEdge key={`${edge.from}-${edge.to}`} from={nodePositions[edge.from]} to={nodePositions[edge.to]} />
  ))}
  {nodes.map(node => (
    <JobNode key={node.id} node={node} position={nodePositions[node.id]} onClick={() => setSelected(node.id)} />
  ))}
</svg>
```

---

## NODE COLORS

| Status | Color |
|--------|-------|
| pending | `var(--shadow)` — gray |
| running | `var(--cyan)` — blue/teal |
| complete | `var(--success)` — green |
| partial | `var(--warning)` — amber |
| failed | `var(--error)` — red |
| interrupted | `var(--muted)` — dimmed |

Use GregLite's CSS variable system (inherited from Gregore).

---

## MANIFEST DETAIL SIDEBAR

Clicking a node opens a right-side panel showing:
- Task title and type
- Status badge
- Success criteria list (checked/unchecked)
- Files modified
- Token usage and cost
- Start/end times
- Error message if failed
- "Restart" button if failed or interrupted

---

## REAL-TIME UPDATES

Poll KERNL manifests table every 5 seconds. Diff previous graph against new graph. Animate status transitions — nodes pulse when status changes. Use `requestAnimationFrame` for smooth animation.

---

## ACCESS

War Room is a tab at the top of the strategic thread area, or full-screen via Cmd+W:

```
│ [★ Strategic] [⚙ Workers] [🗺 War Room] +
```

---

## DEPENDENCY ON 2A

War Room needs the manifest schema defined by Sprint 2A to read dependency data. Start 2E after 2A commits its manifest schema (`app/lib/agent-sdk/types.ts` with `TaskManifest` interface) — not after 2A is fully complete. War Room can build against empty manifests table using mock data for layout testing.

---

## GATES

- [ ] War Room tab accessible
- [ ] Empty state displays correctly
- [ ] Mock manifests with dependencies render as graph
- [ ] Node colors reflect status
- [ ] Edges show dependency direction
- [ ] Clicking node opens detail sidebar
- [ ] Graph polls and updates without full re-render
- [ ] pnpm type-check clean
- [ ] Commit: `sprint-2e: war room, dependency graph UI`
