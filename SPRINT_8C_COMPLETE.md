# Sprint 8C — Installer, Auto-Updater, Version 1.0.0

**Status**: COMPLETE
**Commit**: `5de4800` sprint-8c: installer, auto-updater, v1.0.0
**Date**: 2026-03-04

## Deliverables

### Version Bump (0.1.0 → 1.0.0)
- `app/package.json`
- `app/src-tauri/Cargo.toml`
- `app/src-tauri/tauri.conf.json`

### NSIS Installer
- Install mode: `currentUser` (no admin required)
- Start menu folder: "Gregore Lite"
- Output: `src-tauri/target/release/bundle/nsis/Gregore Lite_1.0.0_x64-setup.exe`

### MSI Installer (bonus — Tauri builds both by default)
- Output: `src-tauri/target/release/bundle/msi/Gregore Lite_1.0.0_x64_en-US.msi`

### Auto-Updater
- Plugin: `tauri-plugin-updater v2.9.0`
- Endpoint: `https://github.com/duke-of-beans/GregoreLite/releases/latest/download/latest.json`
- Dialog mode: user-prompted update
- Signing: minisign keypair generated, pubkey in tauri.conf.json, private key at `.keys/updater.key` (gitignored)
- Password: `greglite`

### Build Pipeline
- `build-installer.bat`: Full pipeline — cleans .next cache, moves API routes out, runs static export, restores routes, runs cargo tauri build
- `scripts/tauri-prebuild.bat`: Called by Tauri's beforeBuildCommand — handles the API route exclusion + static export
- `RELEASE_CHECKLIST.md`: Documents signing, tagging, GitHub Release creation, latest.json format

### Identifier Fix
- Changed from `ai.greglite.app` to `ai.greglite.desktop` (`.app` suffix conflicts with macOS bundle extension)

## Build Results
- Release binary: `gregore.exe` (17m 03s compilation, -j 1 to avoid OOM)
- 377 Rust crates compiled in release mode
- NSIS + MSI installers produced successfully

## Key Decisions
- **API route exclusion during static export**: Next.js `output: 'export'` cannot coexist with API routes. Solution: prebuild script temporarily moves `app/api/` and `app/middleware.ts` out, builds, then restores them. API routes are dev-only; Tauri app uses Tauri commands.
- **tray-icon feature**: Added `features = ["tray-icon"]` to Cargo.toml tauri dependency (required for existing tray module).
- **Single-threaded Rust build**: `-j 1` flag avoids OOM on memory-constrained machines. Trade-off: 17min build time.
- **.next cache must be cleaned**: Stale type validator references API routes even after they're moved. `rmdir /s /q .next` before export.

## Verification
- `tsc --noEmit`: clean (0 errors)
- `vitest run`: 887/890 passed, 3 pre-existing failures (detector.test.ts x2, phase5-integration.test.ts x1 — unrelated to 8C changes)
