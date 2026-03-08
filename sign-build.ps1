$ErrorActionPreference = "Stop"

$keyContent = Get-Content "D:\Projects\GregLite\app\src-tauri\.keys\updater.key" -Raw
[System.Environment]::SetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY", $keyContent.Trim(), "Process")
[System.Environment]::SetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "greglite", "Process")

Write-Host "Signing env vars set. Key length: $($keyContent.Trim().Length)"

Set-Location "D:\Projects\GregLite\app\src-tauri"
npx @tauri-apps/cli build --bundles nsis
