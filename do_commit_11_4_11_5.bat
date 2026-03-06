@echo off
cd /d D:\Projects\GregLite
git add -A
git status
git commit -m "feat: Sprint 11.4+11.5 — Transit Map Z3 annotations + Z2 subway view

Phase C (Z3 Detail Annotations):
- MessageMetadata.tsx: model badge, token counts, cost, latency
- EventMarkers.tsx: SVG shape renderers driven by registry config
- EventDetailPanel.tsx: right slide-in drawer with annotation support
- Message.tsx: extended with id, messageEvents, showTransitMetadata, onMarkerClick
- MessageList.tsx: single shared event fetch, Map<message_id, EnrichedEvent[]>
- ChatInterface.tsx: Cmd+Shift+M toggle, Cmd+T transit tab, split view
- AppearanceSection.tsx: Transit Map toggle pill
- ui-store.ts: showTransitMetadata state + toggleTransitMetadata()
- lib/transit/types.ts: EnrichedEvent, EventsApiResponse, Station types
- api/transit/events/[id]/route.ts: PATCH for user annotations
- 36 new tests (MessageMetadata 22, EventMarkers 14)

Phase D (Z2 Subway View):
- lib/transit/stations.ts: resolveTemplate() + generateStations() pure fns
- SubwayMap.tsx: full SVG renderer; indexToX() + extractBranchSegments() exported
- SubwayStationNode.tsx: station label/icon, click-to-scroll
- SubwayMarkerDot.tsx: event dots on track, colored by category
- SubwayBranch.tsx: bezier fork/merge visualization
- Message.tsx Task 12: landmark hover button + inline form
- MessageList.tsx Task 12: handleMarkAsLandmark + propEvents bypass
- ChatInterface.tsx: transit useEffect hoisting fix (TS2448)
- SubwayMap.test.tsx: 13 pure logic tests (indexToX x6, extractBranchSegments x7)

TSC: 0 errors | Tests: 1165/1168 (+13 this sprint; 3 pre-existing unrelated failures)"
