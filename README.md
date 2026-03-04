# GREGORE LITE

**A cognitive cockpit for Claude — persistent memory, agent jobs, and self-evolution.**

## What It Is

Gregore Lite is a single-user desktop application built on Tauri 2 and Next.js 16 that turns Claude into a strategic partner rather than a stateless chatbot. Every conversation thread persists in KERNL, a local SQLite memory layer that stores threads, decisions, context artefacts, and agent job history. The app runs a full Agent SDK job queue — Claude can spawn background tasks, monitor CI pipelines, and execute multi-step workflows without losing track of what it was doing.

Ghost context pulls ambient intelligence from the filesystem and email — meeting notes, recent file changes, calendar events — and surfaces it alongside the conversation so Claude has the same situational awareness David does. A morning briefing synthesises overnight changes into a concise status before the first message of the day.

The UI is built around a cockpit metaphor: a persistent context panel on the left (decisions, artefacts, job status) and a strategic chat thread on the right. Cross-context linking lets decisions reference artefacts and vice versa. A war room view aggregates job status, AEGIS telemetry, and system health into a single operational dashboard.

## What Makes It Different

Gregore Lite can improve its own codebase. When self-evolution mode is engaged, the app analyses its own source, proposes refactors or feature additions, creates a feature branch, runs the full test suite, and opens a pull request on GitHub. Nothing merges without David's explicit approval — the merge route is authenticated with a per-install token, and the PR review happens in GitHub's standard interface. The app builds the PR; David clicks the button.

This is not an AI wrapper. It is a cognitive tool that accumulates institutional knowledge, maintains strategic context across sessions, and automates its own maintenance cycle.

## Requirements

Windows 10 or 11, Node.js 20 or later, and an Anthropic API key. AEGIS (the external orchestration layer) is optional — the app works fully without it, and the first-run wizard handles the connection check gracefully.

## Install

Download the latest installer from the GitHub Releases page. Run the setup executable and follow the on-screen prompts. On first launch, a four-step onboarding wizard walks through API key entry (validated against Anthropic's API and stored in the Windows Credential Manager — never saved to disk in plaintext), KERNL database initialisation, AEGIS connection test, and a final summary before launching the main cockpit.

## Architecture

The application is a five-layer stack: a Tauri 2 desktop shell wraps a Next.js 16 frontend with a SQLite persistence layer (KERNL), an Agent SDK job execution engine, and an optional AEGIS orchestration bridge. Eight development phases have been completed across 890+ tests with an End-of-Sprint quality score consistently above 85. Security hardening in Phase 8 eliminated shell injection vectors, moved all secrets to the OS keychain, and added authenticated merge routes. Full architectural detail is in `BLUEPRINT_FINAL.md`.

## Development

Clone the repository, then:

```
cd app
pnpm install
pnpm dev
```

The dev server starts on `localhost:3000` with Turbopack hot reload. For a production Tauri build, run `build-installer.bat` from the repository root — it handles the static export (temporarily relocating API routes that are incompatible with Next.js static output), Rust compilation, and NSIS installer packaging in a single pipeline.

Tests run with `pnpm test:run` (Vitest). Type checking with `npx tsc --noEmit`. The End-of-Sprint deep scan (`pnpm eos:scan`) validates code quality, leak detection, and security compliance across the full codebase.

## Self-Evolution

Self-evolution mode is triggered from the Agent SDK job queue. The app creates a feature branch, applies Claude-generated patches, runs the full test suite against the modified code, and opens a pull request on GitHub if all checks pass. The merge route requires a per-install authentication token validated with `crypto.timingSafeEqual` — no merge can happen without David reviewing the diff and clicking merge in GitHub. The GitHub Personal Access Token used for PR creation is stored in the Windows Credential Manager via keytar, never in SQLite or on disk.

This creates a closed loop: the app identifies improvements, proposes them as reviewable PRs, and David maintains final authority over every change that lands in the codebase.

---

Built across 8 phases. Shipped as v1.0.0.
