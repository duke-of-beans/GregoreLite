GREGLITE SPRINT 13.0 — Transit Map UX/UI Audit & Polish
Design quality pass across all 13 transit components | March 2026

YOUR ROLE: Audit and polish the entire Transit Map UI surface for design consistency, visual clarity, interaction quality, accessibility, and performance. This is a UX/design sprint — you are fixing styling, spacing, color usage, interaction states, animations, responsive behavior, empty states, and edge cases. You are NOT adding features. David is CEO. Zero debt, polished execution.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\app\app\globals.css — design tokens, color variables, font families. ALL transit components must use ONLY these tokens. No hardcoded hex values.
4. READ EVERY FILE in app/components/transit/ (13 files) before making any changes
5. READ EVERY FILE in app/components/chat/Message.tsx, MessageList.tsx, ChatInterface.tsx — these host the transit components
6. D:\Projects\GregLite\TRANSIT_MAP_SPEC.md §3 (Visual Language) — the design intent
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- Tempted to refactor component APIs or add features — this is POLISH ONLY
- About to change any lib/transit/*.ts logic files — this sprint touches components and styles, not data models
- A style change breaks existing test assertions (update the test, don't remove it)
- Sonnet has failed on the same problem twice → spawn Opus subagent

---

The Transit Map was built across 5 sprints (11.2–11.7) by different Cowork agents in parallel. Each agent focused on functionality and correctness. The result is 13 working components with inconsistent styling, missing interaction polish, and several UX gaps. This sprint fixes that.

FILES IN SCOPE (13 transit components + 3 host components):
  app/components/transit/ScrollbarLandmarks.tsx
  app/components/transit/MessageMetadata.tsx
  app/components/transit/EventMarkers.tsx
  app/components/transit/EventDetailPanel.tsx
  app/components/transit/SubwayMap.tsx
  app/components/transit/SubwayStationNode.tsx
  app/components/transit/SubwayMarkerDot.tsx
  app/components/transit/SubwayBranch.tsx
  app/components/transit/SankeyView.tsx
  app/components/transit/SankeySegment.tsx
  app/components/transit/SankeyLink.tsx
  app/components/transit/ZoomController.tsx
  app/components/transit/InsightReviewPanel.tsx
  app/components/chat/Message.tsx (transit integration points only)
  app/components/chat/MessageList.tsx (transit integration points only)
  app/components/chat/ChatInterface.tsx (Transit tab layout only)
  app/app/globals.css (add missing CSS variables if needed — do NOT change existing ones)

---

TASK 1: Color token audit

Scan all 13 transit components for hardcoded colors. Every color must reference a CSS variable from globals.css. Known issues to check:

- MessageMetadata: `parseModelLabel()` uses fallback hex `#a78bfa` for opus purple — this should be a CSS variable. Add `--purple-400: #a78bfa` to globals.css if missing.
- InsightReviewPanel: uses `rgba(255,255,255,0.04)`, `rgba(255,255,255,0.06)`, `rgba(255,255,255,0.07)`, `rgba(255,255,255,0.1)`, `rgba(0,0,0,0.3)` — these should be semantic tokens like `var(--elevated)` with opacity, or new `--glass-*` tokens.
- EventDetailPanel: `rgba(0,0,0,0.45)` backdrop, `rgba(245,158,11,0.15)` for amber status, `rgba(52,211,153,0.15)` for green status, `rgba(100,116,139,0.15)` for gray status — extract to tokens or at minimum use the existing `--warning`, `--success`, `--shadow` variables with opacity.
- SankeySegment: opacity values (0.15, 0.2, 0.4, 0.5, 0.6, 0.8, 0.9) scattered inline — consolidate into a consistent set.
- Check: do ALL components respect `[data-theme="light"]` overrides? The token remapping in globals.css should handle this IF components use tokens. Any hardcoded rgba() will break in light mode.

Deliverable: zero hardcoded hex or rgba() values in transit components (except where truly needed for opacity on a token-based color — use `color-mix()` or a consistent pattern).

TASK 2: Typography and spacing consistency

The 13 components were built by different agents with slightly different interpretations of "subtle" and "small":

- Font sizes in use: 9px, 10px, 11px, 12px, 13px — verify these form a coherent hierarchy
- MessageMetadata uses 10px for everything — is this readable at all density settings?
- SubwayStationNode uses 9px labels — may be too small on high-DPI displays
- InsightReviewPanel mixes 9px, 10px, 11px, 12px, 13px within a single card — tighten the range
- EventDetailPanel header is 13px, payload labels 11px, payload values 11px monospace — good hierarchy, verify padding consistency
- SankeyView header uses 11px — should match other panel headers

Spacing audit:
- gap values: 2px, 3px, 4px, 6px, 8px, 12px, 16px used across components — normalize to a 4px grid (4, 8, 12, 16, 24)
- marginBottom values: 3px, 4px, 6px, 8px, 10px, 12px, 14px, 16px — same: normalize to 4px grid
- padding values: similar scatter — normalize

TASK 3: Interaction states and hover polish

Several components have minimal or inconsistent hover/active/focus states:

- EventMarkers: hover scales to 1.2x + opacity change — good but uses inline style mutation via onMouseEnter/onMouseLeave. Convert to CSS :hover where possible for smoother performance.
- SubwayStationNode: no hover state besides cursor:pointer. Add: subtle glow or scale on hover, especially for non-active stations.
- SubwayMarkerDot: check for hover feedback — small dots need generous hit areas (min 24px touch target).
- SankeySegment: has hover state (strokeWidth 2 + label shift) — verify the shift doesn't cause layout jank. The -4px label offset on hover may look jumpy.
- SankeyLink: has cursor:pointer when onClick defined — add opacity change on hover.
- InsightReviewPanel action buttons: have opacity 0.6 when disabled but no hover state when enabled — add hover feedback (darken/lighten).
- EventDetailPanel "Add Note" button: has border-color change on hover — good, but the textarea should also get a focus ring consistent with the design system.
- ZoomIndicator: buttons change background/color on active — add hover transition for non-active buttons.

General: all interactive elements should have `transition: all 0.15s ease` or similar for smooth state changes. Verify no jarring pops.

TASK 4: Keyboard accessibility

- EventDetailPanel: has Escape to close — good. Add focus trap (Tab cycles within panel while open).
- EventMarkers: buttons have aria-label — good. Verify they're focusable and show focus-visible ring.
- SubwayStationNode: has role="button" and aria-label — good. Add focus-visible styling.
- SankeySegment: has role="button" and aria-label — good. Add keyboard Enter/Space handler and focus-visible styling.
- ZoomIndicator: buttons should show current zoom state to screen readers (aria-pressed or aria-current).
- InsightReviewPanel: verify all buttons have descriptive aria-labels, not just "Approve" (should be "Approve insight: [title]").

TASK 5: Empty states and edge cases

Review each component for degrade behavior:

- SubwayMap with 0 stations: does it show a helpful message or just blank space?
- SubwayMap with 1 message: does indexToX handle this without division by zero? (it does per code review — verify visually)
- SankeyView with 0 messages: shows "No conversation data" — good. Verify the message is centered and styled.
- SankeyView with 1 segment (no stations): should show a single full-width segment, not break.
- MessageMetadata with all undefined props: returns null — good.
- EventMarkers with empty events: returns null — good.
- EventDetailPanel with very long payload values: verify wordBreak works and doesn't overflow the panel width.
- InsightReviewPanel with 0 insights: shows helpful empty state — good. Verify alignment.
- ScrollbarLandmarks with 0 events: should render nothing (not an empty container).
- ZoomController at Z1 with no data: SankeyView should show empty state, not crash.

TASK 6: Animation and transition polish

- ZoomController crossfade: verify the 300ms transition feels smooth. The `isTransitioning` + `previousZoom` state is there — verify ChatInterface actually renders the fade. If it's a hard swap (no fade), implement the crossfade using opacity transitions.
- ScrollbarLandmarks: ticks should fade in on load (not pop). Add a subtle entrance animation (opacity 0→1, 200ms, staggered by 20ms per tick if <20 ticks).
- EventDetailPanel: the slide-in should be animated (transform: translateX(100%) → translateX(0)). Currently it appears to use fixed positioning but no transition — add one.
- SubwayMap: station clicks should have a brief pulse animation on the target station (scale 1→1.3→1, 200ms) before scrolling to the message.
- SankeyView: segment hover transition currently uses `transition: stroke-width 0.15s` — add fill-opacity transition too for smoother hover effect.

TASK 7: Light mode verification

Toggle to light mode (data-theme="light") and verify every transit component:
- All text remains readable (contrast ratio ≥ 4.5:1 for body text)
- SVG shapes use CSS variables, not hardcoded dark-mode colors
- Backgrounds don't blend into the light page background
- Borders remain visible
- The Sankey header bar doesn't disappear
- InsightReviewPanel cards have visible boundaries

If light mode is badly broken for transit components, fix the most egregious issues. Complete light mode polish can be a follow-up if the scope is too large.

TASK 8: Performance check

- MessageList: events are fetched once and passed down (N+1 rule enforced). Verify the useMemo creating the eventsMap isn't re-running on every render (check dependency array).
- SubwayMap: SVG with many stations — verify the SVG doesn't re-render on every scroll event. If the active station tracking causes re-renders, debounce or use useRef.
- SankeyView: buildSankeyGraph is in useMemo — verify the dependency array is correct (should be [events, stations, totalMessages], not [events] alone).
- ScrollbarLandmarks: if there are >100 ticks, verify rendering doesn't cause jank during scroll.
- InsightReviewPanel: fetchInsights runs on mount — verify it doesn't re-fetch on every Inspector tab switch.

TASK 9: Visual hierarchy in Transit tab

The Transit tab in ChatInterface shows subway/sankey (25%) above messages (75%). Audit this split:
- Is 25% enough space for the SubwayMap to be useful? Station labels may clip. Consider 30% or making the split draggable.
- Does the SankeyView have enough vertical space? The header takes 36px — with a 25% split on a 900px window, that's ~225px total, ~189px for the SVG. May be tight for branch rendering.
- The divider between map and messages: is there a visual separator? A subtle border-bottom or gradient fade?
- When switching zoom levels (Z1↔Z2), does the top split maintain consistent height?

TASK 10: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing (update test assertions if style changes affect them)
3. Visual check: dark mode + light mode, with and without Transit metadata visible
4. Update STATUS.md
5. Write SPRINT_13_0_COMPLETE.md
6. Commit: "style: Sprint 13.0 — Transit Map UX/UI audit & polish (color tokens, typography, interactions, accessibility, animations)"
7. Push

---

QUALITY GATES:
 1. Zero hardcoded hex/rgba values in transit components (all using CSS tokens)
 2. Font sizes follow coherent hierarchy (no more than 4 sizes per component)
 3. Spacing follows 4px grid
 4. All interactive elements have hover + focus-visible states
 5. All interactive elements have keyboard support (Enter/Space for buttons)
 6. Empty states handled gracefully for every component
 7. EventDetailPanel has slide-in animation
 8. Zoom transitions use crossfade (not hard swap)
 9. Light mode passes visual check (text readable, boundaries visible)
10. No performance regressions (no unnecessary re-renders)
11. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. This is POLISH — do NOT add features, APIs, or data model changes
3. Do NOT modify any file in lib/transit/ (data layer is out of scope)
4. All colors must use CSS variables from globals.css
5. New CSS variables go in globals.css with BOTH dark and light mode values
6. Use cmd shell (not PowerShell)
7. Read ALL 13 transit components before starting changes
8. Preserve all existing functionality — this sprint makes things look better, not work differently
