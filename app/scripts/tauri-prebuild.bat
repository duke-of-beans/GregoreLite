@echo off
REM Called by Tauri's beforeBuildCommand.
REM Moves API routes out, runs Next.js static export, restores them.
REM API routes are dev-only; Tauri app uses Tauri commands for backend.
cd /d D:\Projects\GregLite\app

set TAURI_BUILD=1

REM Clean stale .next cache (has type refs to API routes)
if exist .next (rmdir /s /q .next)

REM Move API routes and middleware out (can't be statically exported)
if exist app\api (move app\api app\_api_backup >nul)
if exist app\middleware.ts (move app\middleware.ts app\_middleware_backup.ts >nul)

call pnpm build
set BUILD_ERR=%errorlevel%

REM Always restore regardless of build result
if exist app\_api_backup (move app\_api_backup app\api >nul)
if exist app\_middleware_backup.ts (move app\_middleware_backup.ts app\middleware.ts >nul)

exit /b %BUILD_ERR%
