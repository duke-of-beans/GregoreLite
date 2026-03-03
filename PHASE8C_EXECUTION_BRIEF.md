GREGLITE SPRINT 8C - Installer + Auto-Updater + Version 1.0.0
Phase 8, Sprint 3 of 4 | March 2026

YOUR ROLE: Build the Windows installer and auto-updater, then bump the version to 1.0.0. This is the difference between a dev build and a shippable product. The installer should feel as polished as AEGIS v1.0.0 — NSIS, silent install option, Start Menu shortcut, proper uninstaller. Auto-updater uses tauri-plugin-updater so David gets prompted when a new version is available. tauri.conf.json version moves from 0.1.0 to 1.0.0. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\SPRINT_8B_COMPLETE.md
7. Read D:\Dev\aegis\installer\ structure and D:\Dev\aegis\tauri.conf.json as reference for what a working NSIS Tauri installer looks like in this codebase. Borrow the pattern directly.
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- tauri-plugin-updater requires a public update server endpoint — design the update manifest hosting strategy before implementing. GitHub Releases is the correct answer for a solo desktop app: the updater checks a GitHub release endpoint. No separate server needed.
- The NSIS installer configuration requires code signing for Windows Defender to not flag it — document whether a self-signed cert is acceptable for initial v1.0.0 or if this blocks ship. Do not silently skip the signing question.
- The Tauri build process fails for the Windows target on this machine — read actual error output, do not guess. If cross-compilation is required, document the path.
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Read D:\Dev\aegis\ Tauri conf and installer config as reference → mechanical read
[HAIKU] Read tauri-plugin-updater documentation → web fetch, mechanical
[HAIKU] Update tauri.conf.json: version 0.1.0 → 1.0.0, add bundle.windows.nsis config, add updater config → mechanical config edit
[HAIKU] Update app/package.json: version 0.1.0 → 1.0.0 → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 8C complete, write SPRINT_8C_COMPLETE.md, git commit, push
[SONNET] Add tauri-plugin-updater to Cargo.toml and src-tauri/src/main.rs — wire the updater plugin
[SONNET] Write the update manifest format (latest.json) for GitHub Releases hosting — document the exact JSON schema so David can upload it alongside each release
[SONNET] Configure NSIS installer: product name "Gregore Lite", publisher, install dir C:\Users\{user}\AppData\Local\GregoriteLite, Start Menu shortcut, uninstaller, silent install flag
[SONNET] Write build-installer.bat at repo root — one command to build the full release: pnpm build → tauri build → output path printed
[SONNET] Write RELEASE_CHECKLIST.md — exact steps David runs for every future release (version bump, build, tag, GitHub Release, upload installer + latest.json)
[OPUS] Escalation only if Sonnet fails twice — particularly if Tauri's Windows build chain has issues on this specific machine

QUALITY GATES:
1. tauri.conf.json version = "1.0.0"
2. app/package.json version = "1.0.0"
3. NSIS installer config present in tauri.conf.json bundle.windows section
4. Installer produces .exe artifact in app/src-tauri/target/release/bundle/nsis/
5. Installer: product name "Gregore Lite", publisher field populated, Start Menu shortcut created, uninstaller registered
6. tauri-plugin-updater added and compiles without error
7. Update check endpoint configured (GitHub Releases URL pattern)
8. latest.json schema documented in RELEASE_CHECKLIST.md
9. build-installer.bat runs end-to-end without manual intervention
10. RELEASE_CHECKLIST.md covers: version bump, build, git tag, GitHub Release creation, file uploads
11. pnpm test:run zero failures (tests should be unaffected by installer changes)

TAURI.CONF.JSON ADDITIONS (merge into existing, do not replace):
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [...existing...],
    "windows": {
      "nsis": {
        "displayLanguageSelector": false,
        "installMode": "currentUser",
        "shortcutName": "Gregore Lite"
      }
    }
  },
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/[OWNER]/[REPO]/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "[GENERATE_AND_FILL]"
    }
  }

OWNER and REPO should be read from the existing git remote config (git remote get-url origin). If no remote exists, use placeholder strings and document in SPRINT_8C_COMPLETE.md.

The updater pubkey must be generated with `tauri signer generate` and stored. The private key goes in the GitHub Actions secret (for future CI signing); the public key goes in tauri.conf.json. For v1.0.0 without CI, document in RELEASE_CHECKLIST.md that the developer must sign the release artifact manually with `tauri signer sign` before uploading.

LATEST.JSON FORMAT (document this in RELEASE_CHECKLIST.md):
  {
    "version": "1.0.0",
    "notes": "Release notes here",
    "pub_date": "2026-03-02T00:00:00Z",
    "platforms": {
      "windows-x86_64": {
        "signature": "[output of tauri signer sign]",
        "url": "https://github.com/[OWNER]/[REPO]/releases/download/v1.0.0/Gregore-Lite_1.0.0_x64-setup.exe"
      }
    }
  }

BUILD-INSTALLER.BAT:
  @echo off
  echo Building Gregore Lite v1.0.0...
  cd /d D:\Projects\GregLite\app
  call pnpm build
  if %errorlevel% neq 0 (echo BUILD FAILED && exit /b 1)
  cd src-tauri
  cargo tauri build
  if %errorlevel% neq 0 (echo TAURI BUILD FAILED && exit /b 1)
  echo.
  echo Build complete. Installer at:
  echo D:\Projects\GregLite\app\src-tauri\target\release\bundle\nsis\
  echo.
  echo Next steps: see RELEASE_CHECKLIST.md

SIGNING NOTE:
Windows Defender will warn on unsigned executables. For v1.0.0 personal use this is acceptable — David can click through. Document this in SPRINT_8C_COMPLETE.md under "Code Signing". The path to proper code signing (EV certificate or Microsoft trusted publisher) is a post-v1.0.0 concern.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Attempt tauri build — document success or any build errors in SPRINT_8C_COMPLETE.md
4. Update STATUS.md - Sprint 8C complete
5. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-8c: v1.0.0 — NSIS installer, tauri-plugin-updater, build-installer.bat, RELEASE_CHECKLIST.md)
6. git push
7. Write SPRINT_8C_COMPLETE.md: build output path, installer artifact verified, updater config, signing status, any build issues encountered

GATES CHECKLIST:
- tauri.conf.json version = "1.0.0"
- app/package.json version = "1.0.0"
- NSIS config present (installMode, shortcutName)
- tauri-plugin-updater in Cargo.toml and main.rs
- Updater endpoint URL set (GitHub Releases pattern)
- Updater pubkey generated and in tauri.conf.json
- build-installer.bat exists at repo root and is executable
- RELEASE_CHECKLIST.md covers full release process including latest.json upload
- Signing status documented (acceptable for v1.0.0 personal use)
- pnpm test:run clean
- Commit pushed via cmd -F flag
