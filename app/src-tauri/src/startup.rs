// startup.rs — Sprint 31.0
//
// OS startup registration for GregLite.
// Writes / removes / checks the OS mechanism that launches the app on boot.
//
// Windows : HKCU\Software\Microsoft\Windows\CurrentVersion\Run  (no elevation required)
// macOS   : ~/Library/LaunchAgents/ai.greglite.desktop.plist
//
// All three public functions are exposed as Tauri commands:
//   startup_register   → register_startup()
//   startup_unregister → unregister_startup()
//   startup_is_registered → is_registered_startup()
//
// Error handling: every operation returns Result. Never panics.
// The caller (TypeScript layer) treats all errors as graceful no-ops.

use tauri::AppHandle;

// ── Windows implementation ────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod platform {
    use std::path::PathBuf;
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const VALUE_NAME: &str = "GregLite";

    fn exe_path() -> Result<PathBuf, String> {
        std::env::current_exe()
            .map_err(|e| format!("could not resolve exe path: {e}"))
    }

    pub fn register(app_handle: &tauri::AppHandle) -> Result<(), String> {
        let _ = app_handle; // not needed on Windows — path comes from current_exe
        let path = exe_path()?;
        let path_str = path
            .to_str()
            .ok_or_else(|| "exe path is not valid UTF-8".to_string())?;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (run_key, _) = hkcu
            .create_subkey(RUN_KEY)
            .map_err(|e| format!("could not open Run key: {e}"))?;

        run_key
            .set_value(VALUE_NAME, &path_str)
            .map_err(|e| format!("could not write startup value: {e}"))
    }

    pub fn unregister(_app_handle: &tauri::AppHandle) -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = match hkcu.open_subkey_with_flags(RUN_KEY, KEY_WRITE) {
            Ok(k) => k,
            // Key doesn't exist → already unregistered, treat as success.
            Err(_) => return Ok(()),
        };

        match run_key.delete_value(VALUE_NAME) {
            Ok(_) => Ok(()),
            // Value doesn't exist → already gone, treat as success.
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("could not remove startup value: {e}")),
        }
    }

    pub fn is_registered(_app_handle: &tauri::AppHandle) -> Result<bool, String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = match hkcu.open_subkey_with_flags(RUN_KEY, KEY_READ) {
            Ok(k) => k,
            Err(_) => return Ok(false),
        };

        let result: std::io::Result<String> = run_key.get_value(VALUE_NAME);
        Ok(result.is_ok())
    }
}

// ── macOS implementation ──────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod platform {
    use std::path::PathBuf;

    const PLIST_ID: &str = "ai.greglite.desktop";

    fn plist_path() -> Result<PathBuf, String> {
        let home = std::env::var("HOME")
            .map_err(|_| "HOME env var not set".to_string())?;
        Ok(PathBuf::from(home)
            .join("Library/LaunchAgents")
            .join(format!("{PLIST_ID}.plist")))
    }

    fn exe_path() -> Result<String, String> {
        // On macOS the exe lives inside the .app bundle; we want the bundle path
        // for LaunchServices. Fall back to the raw exe path if bundle detection fails.
        let exe = std::env::current_exe()
            .map_err(|e| format!("could not resolve exe path: {e}"))?;

        // Walk up to find the .app bundle root (Contents/MacOS/<exe> → ../../)
        if let Some(bundle) = exe.ancestors().find(|p| {
            p.extension().map(|e| e == "app").unwrap_or(false)
        }) {
            return bundle
                .to_str()
                .map(str::to_owned)
                .ok_or_else(|| "bundle path is not valid UTF-8".to_string());
        }

        exe.to_str()
            .map(str::to_owned)
            .ok_or_else(|| "exe path is not valid UTF-8".to_string())
    }

    fn plist_content(path: &str) -> String {
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{PLIST_ID}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{path}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/tmp/{PLIST_ID}.err</string>
    <key>StandardOutPath</key>
    <string>/tmp/{PLIST_ID}.out</string>
</dict>
</plist>
"#
        )
    }

    pub fn register(_app_handle: &tauri::AppHandle) -> Result<(), String> {
        let path = exe_path()?;
        let plist = plist_path()?;

        // Ensure LaunchAgents directory exists.
        if let Some(dir) = plist.parent() {
            std::fs::create_dir_all(dir)
                .map_err(|e| format!("could not create LaunchAgents dir: {e}"))?;
        }

        std::fs::write(&plist, plist_content(&path))
            .map_err(|e| format!("could not write plist: {e}"))
    }

    pub fn unregister(_app_handle: &tauri::AppHandle) -> Result<(), String> {
        let plist = plist_path()?;
        if plist.exists() {
            std::fs::remove_file(&plist)
                .map_err(|e| format!("could not remove plist: {e}"))?;
        }
        Ok(())
    }

    pub fn is_registered(_app_handle: &tauri::AppHandle) -> Result<bool, String> {
        let plist = plist_path()?;
        Ok(plist.exists())
    }
}

// ── Fallback for other platforms ──────────────────────────────────────────────

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod platform {
    pub fn register(_app_handle: &tauri::AppHandle) -> Result<(), String> {
        Err("startup registration not supported on this platform".to_string())
    }

    pub fn unregister(_app_handle: &tauri::AppHandle) -> Result<(), String> {
        Ok(()) // no-op — nothing was ever written
    }

    pub fn is_registered(_app_handle: &tauri::AppHandle) -> Result<bool, String> {
        Ok(false)
    }
}

// ── Tauri command surface ─────────────────────────────────────────────────────

/// Register GregLite to launch on OS startup.
/// Windows: writes HKCU Run registry value.
/// macOS: creates LaunchAgents plist with RunAtLoad = true.
#[tauri::command]
pub fn startup_register(app_handle: AppHandle) -> Result<(), String> {
    platform::register(&app_handle)
}

/// Remove the OS startup entry for GregLite.
#[tauri::command]
pub fn startup_unregister(app_handle: AppHandle) -> Result<(), String> {
    platform::unregister(&app_handle)
}

/// Check whether GregLite is currently registered to launch on startup.
/// Returns true if the registry value / plist exists, false otherwise.
/// Never panics — returns false on any read error.
#[tauri::command]
pub fn startup_is_registered(app_handle: AppHandle) -> bool {
    platform::is_registered(&app_handle).unwrap_or(false)
}
