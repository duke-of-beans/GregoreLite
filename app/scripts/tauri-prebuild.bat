@echo off
REM Called by Tauri's beforeBuildCommand.
REM Sprint 36.0: API routes are now served by the Node.js sidecar in production.
REM No route stripping needed — sidecar build runs first, then Next.js static export.
cd /d D:\Projects\GregLite\app

set TAURI_BUILD=1

REM Clean stale .next cache (has type refs that may be stale)
if exist .next (rmdir /s /q .next)

REM ── Build the API sidecar (transpile + pkg -> binaries/) ─────────────────────
echo [prebuild] Building API sidecar...
call D:\Projects\GregLite\sidecar\build.bat
if %errorlevel% neq 0 (
  echo [prebuild] ERROR: sidecar build failed ^(exit %errorlevel%^)
  exit /b %errorlevel%
)
echo [prebuild] Sidecar build OK

REM ── Next.js static export ────────────────────────────────────────────────────
echo [prebuild] Running Next.js build...
call pnpm build
set BUILD_ERR=%errorlevel%

exit /b %BUILD_ERR%
