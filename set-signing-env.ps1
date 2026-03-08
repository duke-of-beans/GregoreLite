$key = Get-Content "D:\Projects\GregLite\app\src-tauri\.keys\updater.key" -Raw
$key = $key.Trim()
[Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\Environment", "TAURI_SIGNING_PRIVATE_KEY", $key)
[Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\Environment", "TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "greglite")
Write-Host "Registry env vars written. Key length: $($key.Length)"
