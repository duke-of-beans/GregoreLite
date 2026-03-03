# Sprint 9-06: Ghost Teach Me — COMPLETE

**Commit:** 0e459fe
**Files:** 4 new, 4 modified (+559 lines)

## New Files
- `components/ghost/TeachGhostDrawer.tsx` — micro-drawer anchored to card
- `components/ghost/PreferencesPanel.tsx` — Privacy Dashboard preferences list
- `lib/ghost/preferences-store.ts` — CRUD for ghost_preferences table
- `app/api/ghost/preferences/route.ts` — GET/POST/DELETE/PATCH

## Modified
- `components/ghost/GhostCard.tsx` — add Teach Ghost drawer state
- `components/ghost/GhostCardActions.tsx` — add Teach Ghost button
- `components/ghost/PrivacyDashboard.tsx` — add Preferences tab
- `lib/ghost/scorer/index.ts` — query preferences, apply boost_factor

## Quality Gates
- tsc: CLEAN
- Tests: 890/890 PASS
- Baseline: HELD (40 files / 890 tests / EoS 82)
