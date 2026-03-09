@echo off
REM ============================================================
REM GregLite Dev Launcher
REM Clears GregLite port range (37170-37179) before every launch
REM to guarantee a clean slate. Run this instead of pnpm tauri dev.
REM ============================================================

echo [dev-launch] Clearing GregLite port range 37170-37179...

REM Kill anything on ports 37170 through 37179
for /L %%P in (37170,1,37179) do (
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%%P "') do (
        if not "%%a"=="" (
            echo [dev-launch] Killing PID %%a on port %%P
            taskkill /PID %%a /F >nul 2>&1
        )
    )
)

REM Also kill any stale node.exe processes still holding .next lock
REM (only the ones in GregLite's working directory)
echo [dev-launch] Clearing stale Next.js lock...
if exist "D:\Projects\GregLite\app\.next\dev\lock" (
    del /f "D:\Projects\GregLite\app\.next\dev\lock" >nul 2>&1
    echo [dev-launch] Lock file removed.
) else (
    echo [dev-launch] No lock file found ^(clean^).
)

echo [dev-launch] Port range clear. Launching GregLite dev...
echo.

cd /d D:\Projects\GregLite\app
pnpm tauri dev
