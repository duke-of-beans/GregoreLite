// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aegis;
mod ghost;
mod notifications;
mod startup;
mod tray;

use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use aegis::{
    aegis_cancel_timer, aegis_list_profiles, aegis_metrics, aegis_set_timer, aegis_status,
    aegis_switch_profile,
};
use ghost::{
    ghost_pause, ghost_resume, ghost_start_watching, ghost_state, ghost_stop_watching,
};
use notifications::send_notification;
use startup::{startup_is_registered, startup_register, startup_unregister};
use tray::set_tray_badge;

/// Holds the greglite-server sidecar process handle.
/// Stored in Tauri managed state so it can be killed on window close.
/// Option<> allows degraded mode: app continues even if sidecar fails to spawn.
struct SidecarChild(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .manage(ghost_state())
        .manage(aegis::aegis_state())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            tray::setup_tray(app.handle())?;

            // ── Spawn the Node.js API sidecar (Sprint 36.0) ──────────────────
            // greglite-server serves all /api/* endpoints on localhost:3717.
            // Degraded mode: if spawn fails, the app continues — API calls will
            // fail with connection errors (visible in UI) but the app won't crash.
            match app.shell().sidecar("greglite-server") {
                Ok(cmd) => match cmd.spawn() {
                    Ok((_rx, child)) => {
                        app.manage(SidecarChild(Mutex::new(Some(child))));
                        eprintln!("[tauri] greglite-server started on http://127.0.0.1:3717");
                    }
                    Err(e) => {
                        eprintln!("[tauri] greglite-server spawn failed: {e} — degraded mode");
                        app.manage(SidecarChild(Mutex::new(None)));
                    }
                },
                Err(e) => {
                    eprintln!("[tauri] greglite-server sidecar init failed: {e} — degraded mode");
                    app.manage(SidecarChild(Mutex::new(None)));
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ghost_start_watching,
            ghost_stop_watching,
            ghost_pause,
            ghost_resume,
            send_notification,
            set_tray_badge,
            aegis_status,
            aegis_switch_profile,
            aegis_metrics,
            aegis_list_profiles,
            aegis_set_timer,
            aegis_cancel_timer,
            startup_register,
            startup_unregister,
            startup_is_registered,
        ])
        // Sprint 20.0: Belt-and-suspenders Ghost shutdown + sidecar kill on window close.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle().clone();

                // Kill the API sidecar (Sprint 36.0)
                if let Some(sidecar) = app.try_state::<SidecarChild>() {
                    if let Ok(mut guard) = sidecar.0.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                            eprintln!("[tauri] greglite-server killed");
                        }
                    }
                }

                // Chain state() + lock() + stop() so no intermediate borrow
                // outlives its owner (avoids E0597). Sprint 20.0 original.
                let _ = app.state::<ghost::GhostState>().lock().map(|mut w| w.stop());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
