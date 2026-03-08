═══════════════════════════════════════════════════════════════
SPRINT 40.0 — v1.1.1 Patch Release Build
Run FIRST. No dependencies.
Bump version to 1.1.1, rebuild sidecar + installer, tag and publish.
═══════════════════════════════════════════════════════════════

Execute Sprint 40.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\app\src-tauri\tauri.conf.json
  Filesystem:read_file D:\Projects\GregLite\app\package.json
  Filesystem:read_file D:\Projects\GregLite\sidecar\package.json
  Filesystem:read_file D:\Projects\GregLite\app\scripts\tauri-prebuild.bat
  Filesystem:read_file D:\Projects\GregLite\sidecar\build.bat
  Filesystem:read_file D:\Projects\GregLite\app\src-tauri\src\main.rs

Summary: Cut the v1.1.1 patch release. This picks up all changes from Sprints 36-39
(sidecar production API, UX overhaul, tour, settings modal, onboarding import step,
copy audit, transparent drawer fix, DB migration fix). Version bumps in three files,
sidecar rebuild, Next.js export, Tauri NSIS installer build, git tag, GitHub release.

Tasks:

1. **Version bump — three files**:
   - D:\Projects\GregLite\app\src-tauri\tauri.conf.json: "version": "1.1.0" → "1.1.1"
   - D:\Projects\GregLite\app\package.json: "version": "1.1.0" → "1.1.1"
   - D:\Projects\GregLite\sidecar\package.json: "version": "1.1.0" → "1.1.1"
   - These are the only three files that carry the version string.

2. **Verify sidecar source is current**:
   - Read D:\Projects\GregLite\sidecar\src\server.ts to confirm it references the
     current route namespaces and has no Sprint 36.0-era stubs remaining.
   - Read D:\Projects\GregLite\app\lib\api-client.ts to confirm the isTauri() fix
     (localhost check) from the pre-sprint debug session is present.
   - If either file looks stale or has issues, document them — do NOT silently proceed.

3. **Run TypeScript gate before build**:
   - cd /d D:\Projects\GregLite\app && npx tsc --noEmit
   - Must exit 0 before proceeding. If there are errors, fix them.

4. **Run sidecar build**:
   - cd /d D:\Projects\GregLite\sidecar && call build.bat
   - This runs: npm install (if needed) → esbuild bundle → pkg → copy to
     D:\Projects\GregLite\app\src-tauri\binaries\greglite-server-x86_64-pc-windows-msvc.exe
   - Verify the .exe exists and has a non-zero size after the build.
   - If pkg fails with a Node version error: sidecar\package.json targets node18-win-x64.
     If the local Node is v22, pkg may complain about ABI mismatch but still produce a
     working binary (it bundles its own Node runtime). Watch for actual failure vs warning.

5. **Run Next.js export**:
   - cd /d D:\Projects\GregLite\app && pnpm build
   - This produces the static export in D:\Projects\GregLite\app\out\
   - Watch for build errors. Common issue: any component that uses next/headers or
     server-only APIs in a page marked for static export will fail here.
   - If build fails, read the error carefully — do not guess. Fix the specific file.

6. **Run Tauri build**:
   - cd /d D:\Projects\GregLite\app && pnpm tauri build
     (which runs beforeBuildCommand = scripts\tauri-prebuild.bat first, then cargo build)
   - NOTE: tauri-prebuild.bat will re-run the sidecar build AND pnpm build again.
     This is intentional — Tauri's beforeBuildCommand runs before the Rust compile.
     The duplicate sidecar build is fast (esbuild cached) and the duplicate Next.js
     build is fine (it will just overwrite the out/ directory identically).
   - The final output is:
     D:\Projects\GregLite\app\src-tauri\target\release\bundle\nsis\Gregore Lite_1.1.1_x64-setup.exe
   - Verify this file exists and has a size > 10MB after the build.

7. **Verify the installer**:
   - Run: dir "D:\Projects\GregLite\app\src-tauri\target\release\bundle\nsis\"
   - Confirm "Gregore Lite_1.1.1_x64-setup.exe" is present.
   - Also check for the .sig file (updater signature) alongside the .exe.

8. **Generate release notes**:
   - Write D:\Projects\GregLite\RELEASE_NOTES_1.1.1.md with the following content:

     # GregLite v1.1.1 — Patch Release

     **Release date:** March 8, 2026
     **Type:** Patch — UX overhaul + production stability

     ## What's New

     ### Onboarding & Tour
     - Welcome tour expanded from 8 to 10 steps — covers Transit Map and Projects
     - Onboarding wizard gains a 5th step: "Connect your work" with project folder
       picker and import path
     - Tour selectors fixed — all steps now correctly highlight their target elements

     ### Navigation & Settings
     - Settings panel redesigned as a full-window centered modal (was a cramped 400px
       right drawer) with a two-column layout and icon sidebar
     - Collapsed status bar now shows a visible "▲ System Status" bar — was an
       invisible 6px strip

     ### Contextual Help
     - New HelpPopover component — inline ? buttons throughout the app explain what
       each section does in plain English
     - SUGGESTION ARCHIVE panel (formerly Context Library) now has a solid background
       and a subtitle explaining its purpose

     ### Bug Fixes
     - Fixed: Projects panel crash on fresh install ("no such table: portfolio_projects")
       — database migration now creates the table before any ALTER statements reference it
     - Fixed: "Internal Server Error" on first launch in dev mode — isTauri() now
       correctly returns false when the frontend loads from http://localhost

     ## Upgrade Notes
     This is a drop-in patch over v1.1.0. No data migration needed. The database
     migration fix runs automatically on first launch.

9. **Git: commit, tag, push**:
   - Sync docs first: STATUS.md Last Updated header updated to "March 8, 2026 — v1.1.1 patch release built"
   - Stage: D:\Program Files\Git\cmd\git.exe add -A
   - Write commit message to D:\Projects\GregLite\app\temp_commit_msg.txt:
     release: v1.1.1 patch -- UX overhaul, tour fix, settings modal, DB migration fix
   - Commit: D:\Program Files\Git\cmd\git.exe commit -F D:\Projects\GregLite\app\temp_commit_msg.txt
   - Tag: D:\Program Files\Git\cmd\git.exe tag v1.1.1
   - Push: D:\Program Files\Git\cmd\git.exe push origin main
   - Push tag: D:\Program Files\Git\cmd\git.exe push origin v1.1.1

10. **GitHub release (optional — only if gh CLI is available)**:
    - Check if gh is available: where gh
    - If available:
      gh release create v1.1.1 \
        "D:\Projects\GregLite\app\src-tauri\target\release\bundle\nsis\Gregore Lite_1.1.1_x64-setup.exe" \
        --title "GregLite v1.1.1" \
        --notes-file D:\Projects\GregLite\RELEASE_NOTES_1.1.1.md
    - If gh is NOT available: document the manual GitHub release steps in STATUS.md
      and stop here. The tag + binary are ready; David can create the release manually.

CRITICAL CONSTRAINTS:
- TypeScript gate (Task 3) MUST pass before any build steps.
- Version must be bumped in ALL THREE files — tauri.conf.json, app/package.json,
  sidecar/package.json. Missing any one will cause version mismatch in the installer.
- The sidecar binary MUST be rebuilt — it contains the compiled API routes. Stale
  binary = Sprints 37/38/39 UX changes missing from production routes.
- DO NOT run pnpm tauri build without the sidecar binary present in
  app/src-tauri/binaries/. Tauri will fail with "externalBin not found".
- If the Tauri build fails with a code-signing error, this is expected on unsigned
  builds. Check if there is a TAURI_SIGNING_PRIVATE_KEY env var. If not, the build
  may still succeed with an unsigned installer — check output carefully.
- Git operations: use full path D:\Program Files\Git\cmd\git.exe
- Commit message via temp file to avoid em-dash encoding failures in cmd.
- Shell: cmd (not PowerShell) for all build commands.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell) with cd /d D:\Projects\GregLite\app
Git: D:\Program Files\Git\cmd\git.exe — commit message to temp_commit_msg.txt then git commit -F temp_commit_msg.txt
