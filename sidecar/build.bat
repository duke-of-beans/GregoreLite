@echo off
REM GregLite sidecar build script — Sprint 36.0
REM Transpiles + bundles src/server.ts -> dist/server.js via esbuild,
REM then packages into a self-contained .exe via @vercel/pkg.
REM Copies the final binary to src-tauri/binaries/ using the Rust host triple.
REM
REM Called by: D:\Projects\GregLite\app\scripts\tauri-prebuild.bat

cd /d D:\Projects\GregLite\sidecar

REM ── 1. Install sidecar deps if node_modules is missing ───────────────────────
if not exist node_modules (
  echo [sidecar] Installing dependencies...
  call npm install
  if %errorlevel% neq 0 (
    echo [sidecar] ERROR: npm install failed
    exit /b 1
  )
)

REM ── 2. Transpile + bundle with esbuild ───────────────────────────────────────
echo [sidecar] Building dist/server.js...
call npx tsx build.ts
if %errorlevel% neq 0 (
  echo [sidecar] ERROR: esbuild bundle failed
  exit /b 1
)

REM ── 3. Package into self-contained exe via pkg ────────────────────────────────
echo [sidecar] Packaging dist/server.js -> dist/server.exe...
call npx pkg dist/server.js --target node18-win-x64 --output dist\server.exe
if %errorlevel% neq 0 (
  echo [sidecar] ERROR: pkg packaging failed
  exit /b 1
)

REM ── 4. Determine Rust host triple and copy to binaries/ ──────────────────────
for /f "tokens=*" %%t in ('"D:\Program Files\Rust\bin\rustup.exe" show active-toolchain 2^>nul') do (
  set TOOLCHAIN=%%t
)

REM Fallback: use rustc --print host-triple
for /f "tokens=*" %%h in ('"D:\Program Files\Rust\bin\rustc.exe" --print host-triple 2^>nul') do (
  set HOST_TRIPLE=%%h
)

if "%HOST_TRIPLE%"=="" (
  REM Hard-code the known target for this machine
  set HOST_TRIPLE=x86_64-pc-windows-msvc
  echo [sidecar] WARN: could not detect host triple, using %HOST_TRIPLE%
)

echo [sidecar] Host triple: %HOST_TRIPLE%

set BINARIES_DIR=D:\Projects\GregLite\app\src-tauri\binaries
if not exist "%BINARIES_DIR%" mkdir "%BINARIES_DIR%"

set DEST=%BINARIES_DIR%\greglite-server-%HOST_TRIPLE%.exe
copy /y dist\server.exe "%DEST%"
if %errorlevel% neq 0 (
  echo [sidecar] ERROR: failed to copy binary to %DEST%
  exit /b 1
)

echo [sidecar] ✓ Binary ready: %DEST%
exit /b 0
