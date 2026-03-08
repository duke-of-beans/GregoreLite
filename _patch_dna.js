const fs = require('fs');
const base = 'D:/Projects/GregLite';
let dna = fs.readFileSync(base + '/PROJECT_DNA.yaml', 'utf8');

// 1. Header comment line
dna = dna.replace(
  '# Version: v1.1.0 | Sprint 29.0 Quick Capture Pad | March 6, 2026',
  '# Version: v1.1.0 | Sprint 32.0 Headless Browser Mode | March 7, 2026'
);

// 2. current_state.phase
dna = dna.replace(
  '  phase: "v1.1.0 production readiness. Sprints 24-29 shipped. Portfolio + Ambient Memory + Ceremonial Synthesis + Quick Capture complete."',
  '  phase: "v1.1.0 production readiness. Sprints 24-32 shipped. Portfolio + Ambient Memory + Quick Capture + Start at Boot + Headless Browser Mode complete."'
);

// 3. current_state.status — replace the whole block
const oldStatus = `  status: |
    Phases 1-9 shipped. Sprint 10.x-14.x polish and production readiness.
    Sprint 15.x-17.x Gregore UX port. Sprint 18.0 Memory Shimmer + Adaptive Override.
    Sprint 19.0 Sacred Laws enforcement. Sprint 20.0 Ghost Thread activation.
    Sprint 21.0 Framer Motion animations. Sprint 22.0 first launch polish.
    Sprint 23.0 voice audit + responsive breakpoints + UX fixes.
    Sprint 24.0 Portfolio Dashboard: 3 SQLite tables, scanner, 3 API routes,
    PortfolioDashboard + ProjectCard + ProjectDetail, Projects tab (leftmost),
    WORKSPACES.yaml auto-seed, 33 new scanner unit tests.
    Sprint 25.0 Add Existing Project + Intelligent Onboarding: directory scanner,
    type inference, OnboardingChat Q&A, migration (parallel copy + archive rename),
    in-place DNA writing, archive deletion guard, 5 API routes, AddProjectFlow +
    ArchiveManager components, PortfolioDashboard wired. 34 new tests.
    Sprint 26.0 Create New Project + Attention Intelligence: scaffold engine,
    attention analyzer (staleness/blocker/failing-test/mute strategies), NewProjectFlow
    6-step wizard, AttentionQueue with mute/dismiss, 5 API routes. 29 new tests.
    Sprint 27.0 Ambient Memory: recall pipeline (5 strategies), scorer + calibration,
    Ghost-wired scheduler (2 .unref() timers), 5 API routes, RecallCard (amber hover),
    ContextPanel poll, RecallSection settings, Inspector Memory tab. 24 new tests.
    EoS 100/100. 1464 tests. tsc clean.`;

const newStatus = `  status: |
    Phases 1-9 shipped. Sprint 10.x-14.x polish and production readiness.
    Sprint 15.x-17.x Gregore UX port. Sprint 18.0 Memory Shimmer + Adaptive Override.
    Sprint 19.0 Sacred Laws enforcement. Sprint 20.0 Ghost Thread activation.
    Sprint 21.0 Framer Motion animations. Sprint 22.0 first launch polish.
    Sprint 23.0 voice audit + responsive breakpoints + UX fixes.
    Sprint 24.0 Portfolio Dashboard: 3 SQLite tables, scanner, 3 API routes,
    PortfolioDashboard + ProjectCard + ProjectDetail, Projects tab (leftmost),
    WORKSPACES.yaml auto-seed, 33 new scanner unit tests.
    Sprint 25.0 Add Existing Project + Intelligent Onboarding: directory scanner,
    type inference, OnboardingChat Q&A, migration (parallel copy + archive rename),
    in-place DNA writing, archive deletion guard, 5 API routes, AddProjectFlow +
    ArchiveManager components, PortfolioDashboard wired. 34 new tests.
    Sprint 26.0 Create New Project + Attention Intelligence: scaffold engine,
    attention analyzer (staleness/blocker/failing-test/mute strategies), NewProjectFlow
    6-step wizard, AttentionQueue with mute/dismiss, 5 API routes. 29 new tests.
    Sprint 27.0 Ambient Memory: recall pipeline (5 strategies), scorer + calibration,
    Ghost-wired scheduler (2 .unref() timers), 5 API routes, RecallCard (amber hover),
    ContextPanel poll, RecallSection settings, Inspector Memory tab. 24 new tests.
    Sprint 28.0 Ceremonial Synthesis: temporal rituals (daily/weekly/monthly), synthesis
    engine, RitualEngine scheduler, SynthesisViewer, 5 API routes. New tests.
    Sprint 29.0 Quick Capture Pad: global hotkey (Ctrl+Shift+Space), floating capture
    pad, smart parser (type/priority/project routing), cosine-similarity dedup (0.85),
    promote-to-backlog pipeline, CaptureInbox review panel. 1624 tests across 83 files.
    Sprint 30.0 UX Reality Check: 13 UX polish tasks shipped.
    Sprint 31.0 Start at Boot: winreg (Windows) + LaunchAgents plist (macOS), Rust
    startup.rs, TypeScript IPC bridge, StartupSection settings UI, NSIS hooks. 1634 tests.
    Sprint 32.0 Headless Browser Mode: puppeteer-core engine, WebSessionGovernor (rate
    limiting + burst detection), selectors config, fallback router (api/web_session/auto),
    chat route integration, WebSessionSection settings UI, ReceiptFooter routedVia.
    EoS 100/100. 1667 tests across 87 files. tsc clean.`;

if (!dna.includes(oldStatus)) {
  process.stderr.write('ERROR: oldStatus not found in DNA\n');
  process.exit(1);
}
dna = dna.replace(oldStatus, newStatus);

// 4. latest_commits
dna = dna.replace(
  '  latest_commits: "4b32867 (27.0 UI), b376074 (27.0 backend), 9640a64 (26.0), c9f5c94 (25.0), 2fac77f (24.0)"',
  '  latest_commits: "f820ebd (32.0 fallback), 494efed (32.0 commit 2), a38bf15 (32.0 commit 1), 0bff472 (29.0), ab45ae6 (28.0)"'
);

fs.writeFileSync(base + '/PROJECT_DNA.yaml', dna, 'utf8');
process.stderr.write('PROJECT_DNA.yaml patched\n');

// Verify
const lines = dna.split('\n');
process.stderr.write('Line 1: ' + JSON.stringify(lines[1]) + '\n');
process.stderr.write('Line 22: ' + JSON.stringify(lines[22]) + '\n');
process.stderr.write('Line 44: ' + JSON.stringify(lines[44]) + '\n');
// Find latest_commits
lines.forEach((l, i) => { if (l.includes('latest_commits')) process.stderr.write('latest_commits @ ' + i + ': ' + JSON.stringify(l) + '\n'); });
