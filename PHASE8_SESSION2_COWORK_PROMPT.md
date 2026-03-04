Execute Sprint 8C for GregLite — Installer, Auto-Updater, Version 1.0.0.

Read these files IN ORDER before doing anything:
1. D:\Projects\GregLite\PHASE8C_EXECUTION_BRIEF.md — full Sprint 8C spec
2. D:\Projects\GregLite\SPRINT_8B_COMPLETE.md — previous sprint results
3. D:\Projects\GregLite\STATUS.md — current state
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\app\src-tauri\tauri.conf.json — current Tauri config (you'll be modifying this)

CRITICAL CONTEXT: Phase 8 was never built. Sprint 8A and 8B have now been completed. You are continuing the sequence.

SPRINT 8C — Installer + Auto-Updater:
1. Version bump: tauri.conf.json + package.json → 1.0.0
2. Add tauri-plugin-updater to Cargo.toml + main.rs. Configure updater endpoint (GitHub Releases pattern). Generate updater keypair with `tauri signer generate`.
3. Configure NSIS installer in tauri.conf.json: product name "Gregore Lite", currentUser install, Start Menu shortcut, uninstaller.
4. Write build-installer.bat at repo root (pnpm build → tauri build → output path)
5. Write RELEASE_CHECKLIST.md — exact steps for every future release including latest.json upload format
6. ATTEMPT `cargo tauri build` — if it succeeds, document the output path. If it fails due to build environment issues (missing MSVC, Rust toolchain, WebView2), document the exact error and what David needs to install. DO NOT spend more than 10 minutes troubleshooting build failures — document and move on.
7. Tests, tsc clean, commit: "sprint-8c: v1.0.0 — NSIS installer, tauri-plugin-updater, build-installer.bat, RELEASE_CHECKLIST.md"
8. Write SPRINT_8C_COMPLETE.md

IMPORTANT NOTES:
- Reference D:\Dev\aegis\tauri.conf.json for a working NSIS Tauri installer pattern — borrow it
- Git remote: check `git remote get-url origin` for the GitHub repo URL to use in updater endpoint
- Code signing: not required for v1.0.0 personal use — document the Windows Defender warning
- Shell: use cmd (not PowerShell)
- GIT: write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP
- Project path: D:\Projects\GregLite\app
