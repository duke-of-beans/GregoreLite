@echo off
echo ============================================
echo  Building Gregore Lite v1.0.0
echo ============================================
echo.

cd /d D:\Projects\GregLite\app

echo [1/4] Preparing static export (moving API routes out of build)...
REM API routes and middleware are dev-only. Tauri app uses Tauri commands.
if exist .next (rmdir /s /q .next && echo   Cleaned .next cache)
if exist app\api (
    move app\api app\_api_backup >nul
    echo   Moved app\api
)
if exist app\middleware.ts (
    move app\middleware.ts app\_middleware_backup.ts >nul
    echo   Moved middleware.ts
)

echo.
echo [2/4] Building Next.js frontend (static export for Tauri)...
set TAURI_BUILD=1
call pnpm build
set BUILD_ERR=%errorlevel%

echo.
echo [3/4] Restoring API routes...
if exist app\_api_backup (
    move app\_api_backup app\api >nul
    echo   Restored app\api
)
if exist app\_middleware_backup.ts (
    move app\_middleware_backup.ts app\middleware.ts >nul
    echo   Restored middleware.ts
)

if %BUILD_ERR% neq 0 (
    echo.
    echo FRONTEND BUILD FAILED
    exit /b 1
)

echo.
echo [4/4] Building Tauri installer...
cd src-tauri
cargo tauri build
if %errorlevel% neq 0 (
    echo.
    echo TAURI BUILD FAILED
    exit /b 1
)

echo.
echo ============================================
echo  BUILD COMPLETE
echo ============================================
echo.
echo Installer location:
echo   D:\Projects\GregLite\app\src-tauri\target\release\bundle\nsis\
echo.
echo Next steps: see RELEASE_CHECKLIST.md
echo ============================================
