# GREGORE LITE

**A cognitive cockpit for Claude — persistent memory, agent jobs, cross-platform conversation history, and self-evolution.**

## What It Is

Gregore Lite is a single-user desktop application built on Tauri 2 and Next.js 16 that turns Claude into a strategic partner rather than a stateless chatbot. Every conversation thread persists in KERNL, a local SQLite memory layer that stores threads, decisions, context artefacts, and agent job history. The app runs a full Agent SDK job queue — Claude can spawn background tasks, monitor CI pipelines, and execute multi-step workflows without losing track of what it was doing.

Ghost context pulls ambient intelligence from the filesystem and email — meeting notes, recent file changes, calendar events — and surfaces it alongside the conversation so Claude has the same situational awareness you do. A morning briefing synthesises overnight changes into a concise status before the first message of the day.

The UI is built around a cockpit metaphor: a persistent context panel on the left (decisions, artefacts, job status) and a strategic chat thread on the right. Cross-context linking lets decisions reference artefacts and vice versa. A Transit Map visualises conversation flow across three zoom levels: Sankey overview, subway timeline, and full message detail. A War Room aggregates job status, AEGIS telemetry, and system health into a single operational dashboard.

## What Makes It Different

**Memory that spans platforms.** The cross-platform conversation import system (EPIC-81) ingests exported history from claude.ai, ChatGPT, Gemini Takeout, and plain Markdown conversation dumps. A watchfolder daemon (chokidar-backed, 500ms debounce) picks up new exports automatically — drop a file in `~/GregLite/imports/` and it is chunked, embedded, and indexed without any additional steps. Shimmer, the real-time memory highlight system, surfaces matches from both native GregLite conversations and imported history, with platform provenance badges so you always know where a memory came from.

**Self-evolution.** When self-evolution mode is engaged, the app analyses its own source, proposes refactors or feature additions, creates a feature branch, runs the full test suite, and opens a pull request on GitHub. Nothing merges without explicit approval — the merge route is authenticated with a per-install token, and the PR review happens in GitHub's standard interface.

**A full cognitive OS.** Memory Shimmer highlights relevant past context as you type. Adaptive Override remembers how you handle each decision gate category. The Recall engine surfaces forgotten context — file revisits, project milestones, pattern insights — at calibrated intervals. The Learning Engine analyses conversation patterns and proposes configuration improvements (verbosity thresholds, model routing, regeneration rates) as reviewable insights.

This is not an AI wrapper. It is a cognitive tool that accumulates institutional knowledge, maintains strategic context across sessions, imports the history that predates it, and automates its own maintenance cycle.

## Requirements

Windows 10 or 11, Node.js 20 or later, and an Anthropic API key. AEGIS is optional — the app works fully without it.

## Install

Download the latest installer from the GitHub Releases page. Run the setup executable and follow the on-screen prompts. The four-step onboarding wizard handles API key entry (stored in the Windows Credential Manager — never on disk in plaintext), KERNL database initialisation, AEGIS connection test, and a final summary before launching the cockpit.

## Architecture

Five-layer stack: Tauri 2 desktop shell, Next.js 16 frontend, SQLite persistence (KERNL + sqlite-vec for vector search), Agent SDK job execution engine, optional AEGIS orchestration bridge. 1753 tests across 90 files. TSC 0 errors. EoS quality score 100/100.

Nine development phases:
- **Phase 1–5:** Strategic thread, KERNL persistence, cross-context retrieval, decision gate, quality layer
- **Phase 6:** Ghost Thread — filesystem watcher, email connectors, privacy engine, interrupt scorer
- **Phase 7:** Self-Evolution — Agent SDK, permission matrix, cost accounting, SHIM hybrid, CI gate
- **Phase 8:** Ship Prep — security hardening, leak fixes, NSIS installer, first-run onboarding
- **Phase 9 (v1.1.0):** Full Cockpit — 22 sprints covering multi-thread tabs, command palette, notifications, status bar, morning briefing, Transit Map (Sankey + Subway + Learning Engine), manifest templates, settings panel, inspector drawer, decision browser, artifact library, project switcher, and more
- **EPIC-81 (v1.1.0):** Cross-platform conversation memory import — claude.ai, ChatGPT, Gemini, Markdown adapters; watchfolder daemon; Shimmer provenance badges

Full architectural detail in `BLUEPRINT_FINAL.md`.

## Development

```
cd app
pnpm install
pnpm dev
```

Dev server starts on `localhost:3000` with Turbopack hot reload. Production build: `build-installer.bat` from the repository root.

Tests: `pnpm test:run` (Vitest). Type checking: `npx tsc --noEmit`.

## Self-Evolution

Self-evolution mode creates a feature branch, applies Claude-generated patches, runs the full test suite, and opens a pull request on GitHub if all checks pass. The merge route requires a per-install authentication token — no merge can happen without reviewing the diff and clicking merge in GitHub. The GitHub PAT is stored in the Windows Credential Manager via keytar, never in SQLite or on disk.

---

Built across 9 phases + EPIC-81. Current release: v1.1.0.
