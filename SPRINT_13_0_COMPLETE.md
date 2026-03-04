# Sprint 13.0 — Transit Map UX/UI Audit & Polish
**Status:** COMPLETE
**Date:** March 4, 2026
**TSC:** 0 errors
**Tests:** 83/83 transit tests passing (6 test files)

## Summary

Design consistency pass across all 13 transit components. No features added, no data model changes, no lib/transit/ modifications. Pure styling, interaction, accessibility, and animation polish.

## Changes by Task

### Task 1: Color Token Audit
- Added 16 new CSS variables to globals.css with dark AND light mode values: `--purple-400`, `--green-400`, `--amber-400`, `--red-400`, `--glass-subtle`, `--glass-muted`, `--glass-dim`, `--glass-overlay`, `--status-pending-bg`, `--status-success-bg`, `--status-neutral-bg`, `--status-error-bg`, `--backdrop`, `--backdrop-light`
- InsightReviewPanel: replaced 6 hardcoded rgba() values with tokens
- EventDetailPanel: replaced 4 hardcoded rgba() values (LearningStatusPill, backdrop)
- MessageMetadata: removed `#a78bfa` fallback from `--purple-400` reference (token now defined)
- Updated MessageMetadata.test.tsx assertion to match

### Task 2: Typography & Spacing
- Font size hierarchy normalized: 10px (metadata/badges), 11px (labels/headers), 12px (body), 13px (panel headers)
- Eliminated 9px usage: SubwayStationNode labels 9→10, InsightReviewPanel pattern badge 9→10, status badge 9→10
- SubwayBranch fork label 8→10
- Spacing normalized to 4px grid: marginBottom values (3→4, 6→8, 10→8, 14→16), padding values (1px 7px→2px 8px, 3px 8px→4px 8px, 5px 8px→4px 8px, 7px 14px→8px 16px, 5px 11px→4px 12px, 2px 5px→2px 6px), gap values (2→4)

### Task 3: Interaction States
- Added `.transit-interactive`, `.transit-marker-btn`, `.subway-station-hover` CSS classes to globals.css
- EventMarkers: replaced inline onMouseEnter/Leave with CSS `.transit-marker-btn` class
- SubwayStationNode: added hover glow via `.subway-station-hover` CSS class
- SankeySegment: added onFocus/onBlur for keyboard hover state, extended transition to include fill-opacity
- SankeyLink: added opacity hover on clickable links
- ZoomIndicator: added `.transit-interactive` class, `aria-current` attribute
- InsightReviewPanel: added transition on Dismiss button, normalized button padding
- EventDetailPanel: added `.transit-interactive` on Add Note button, transition on Save/Cancel

### Task 4: Keyboard Accessibility
- SubwayStationNode: added `tabIndex={0}`, Enter/Space handler, `onKeyDown`
- SubwayMarkerDot: added `tabIndex={0}`, Enter/Space handler, invisible 24px hit area
- SankeySegment: added `tabIndex={0}`, Enter/Space handler, descriptive aria-label with metrics
- EventDetailPanel: added focus trap (Tab cycles within panel), `role="dialog"`, `aria-label`, auto-focus on open
- InsightReviewPanel: added descriptive `aria-label` on Approve/Dismiss/Rollback buttons (includes insight title)
- ZoomIndicator: added `aria-current` on active zoom level button

### Task 5: Empty States
- Verified all 13 components degrade gracefully: SubwayMap (0 stations → text), SankeyView (0 messages → centered message), MessageMetadata (all undefined → null), EventMarkers (empty → null), ScrollbarLandmarks (0 events → null, not empty container), InsightReviewPanel (0 insights → helpful message), EventDetailPanel (long payloads → wordBreak works)

### Task 6: Animation Polish
- EventDetailPanel: added `slide-in-right` CSS animation (translateX 100%→0, 250ms)
- ScrollbarLandmarks: added `landmark-tick` CSS class with staggered fade-in (opacity 0→target, 200ms, 20ms stagger per tick)
- SubwayStationNode: added click pulse animation (`station-pulse` class, scale 1→1.3→1, 200ms)
- ZoomController crossfade: verified working via opacity transitions in ChatInterface (300ms ease-in-out)
- SankeySegment: existing hover transitions confirmed smooth

### Task 7: Light Mode
- All hardcoded rgba() replaced with CSS tokens that have `[data-theme="light"]` overrides
- Glass tokens use dark-based overlays in light mode (rgba(0,0,0,...) vs rgba(255,255,255,...))
- Status backgrounds adjusted for light mode contrast
- All SVG shapes use CSS variables that remap correctly

### Task 8: Performance
- Verified useMemo dependency arrays: SubwayMap (5 memos, all correct), SankeyView (buildSankeyGraph deps correct: events, stations, totalMessages), ScrollbarLandmarks (no scroll listener)
- InsightReviewPanel: fetchInsights useCallback with [] deps — no re-fetch on tab switches
- No scroll-triggered re-renders found

### Task 9: Transit Tab Layout
- Sankey view: increased from 25% → 30% flex basis, minHeight 140 → 160
- Subway in Z1 mode: reduced to 20% (was 25%) to give Sankey more room
- Subway in Z2 mode: kept at 25%

## Files Modified
- `app/globals.css` — new tokens + transit CSS classes
- `components/transit/ScrollbarLandmarks.tsx` — fade-in animation
- `components/transit/MessageMetadata.tsx` — token cleanup, spacing
- `components/transit/EventMarkers.tsx` — CSS hover class
- `components/transit/EventDetailPanel.tsx` — tokens, slide-in, focus trap, spacing
- `components/transit/SubwayStationNode.tsx` — hover glow, keyboard, pulse, font size
- `components/transit/SubwayMarkerDot.tsx` — keyboard, hit area
- `components/transit/SubwayBranch.tsx` — font size
- `components/transit/SankeySegment.tsx` — keyboard, transitions, aria
- `components/transit/SankeyLink.tsx` — hover opacity
- `components/transit/ZoomController.tsx` — spacing, aria-current, interactive class
- `components/transit/InsightReviewPanel.tsx` — tokens, spacing, aria-labels, transitions
- `components/chat/ChatInterface.tsx` — layout split adjustment
- `components/transit/__tests__/MessageMetadata.test.tsx` — updated assertion

## Quality Gates
1. ✅ Zero hardcoded hex/rgba in transit components (all using CSS tokens)
2. ✅ Font sizes follow coherent hierarchy (10/11/12/13 — max 4 per component)
3. ✅ Spacing follows 4px grid
4. ✅ All interactive elements have hover + focus-visible states
5. ✅ All interactive elements have keyboard support (Enter/Space)
6. ✅ Empty states handled gracefully
7. ✅ EventDetailPanel has slide-in animation
8. ✅ Zoom transitions use crossfade
9. ✅ Light mode tokens added with correct overrides
10. ✅ No performance regressions
11. ✅ tsc clean, all transit tests pass
