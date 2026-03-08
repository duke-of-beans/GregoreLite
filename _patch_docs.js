const fs = require('fs');
const base = 'D:/Projects/GregLite';

// ===== STATUS.md =====
let status = fs.readFileSync(base + '/STATUS.md', 'utf8');

// Line 1: Last Updated header
status = status.replace(
  '**Last Updated:** March 6, 2026 — Sprint 29.0 COMPLETE. Quick Capture Pad: global hotkey (Ctrl+Shift+Space) floating capture pad, smart parser (type/priority/project routing), cosine-similarity dedup (threshold 0.85), promote-to-backlog pipeline, CaptureInbox review panel, CaptureSection in Settings, command palette integration. 1624 tests across 83 files.',
  '**Last Updated:** March 7, 2026 — Sprint 32.0 COMPLETE. Headless Browser Mode: puppeteer-core engine, WebSessionGovernor (rate limiting + burst detection), selectors config, fallback router (api/web_session/auto), chat route integration, WebSessionSection settings UI, ReceiptFooter routedVia display. 1667 tests across 87 files.'
);

// Line 3: Test Count
status = status.replace(
  '**Test Count:** 1624/1624 all green',
  '**Test Count:** 1667/1667 all green'
);

// Line 6: Next sprint
status = status.replace(
  '**Next:** Sprint 30.0 — UX Reality Check (13 tasks). Queue: 31.0 (Start at Boot), 32.0 (Headless Browser Mode with Governor). Briefs: SPRINT_30_0_BRIEF.md, SPRINT_31_32_BRIEF.md.',
  '**Next:** Sprint 33.0 — TBD. Completed: 31.0 (Start at Boot), 32.0 (Headless Browser Mode). Briefs: SPRINT_31_32_BRIEF.md.'
);

// Line 9: Recent commits
status = status.replace(
  '**Recent commits:** 0bff472 (Sprint 29.0), ab45ae6 (Sprint 28.0), c08e9d5 (Sprint 27.0 docs), 4b32867 (Sprint 27.0 UI), b376074 (Sprint 27.0 backend)',
  '**Recent commits:** f820ebd (Sprint 32.0 fallback), 494efed (Sprint 32.0 commit 2), a38bf15 (Sprint 32.0 commit 1), 0bff472 (Sprint 29.0), ab45ae6 (Sprint 28.0)'
);

fs.writeFileSync(base + '/STATUS.md', status, 'utf8');
process.stderr.write('STATUS.md patched\n');

// Verify replacements
const statusNew = fs.readFileSync(base + '/STATUS.md', 'utf8').split('\n');
process.stderr.write('Line 1: ' + JSON.stringify(statusNew[1]) + '\n');
process.stderr.write('Line 3: ' + JSON.stringify(statusNew[3]) + '\n');
process.stderr.write('Line 6: ' + JSON.stringify(statusNew[6]) + '\n');
process.stderr.write('Line 9: ' + JSON.stringify(statusNew[9]) + '\n');
