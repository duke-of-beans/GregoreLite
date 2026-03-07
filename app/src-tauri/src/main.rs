// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aegis;
mod ghost;
mod notifications;
mod startup;
mod tray;

use tauri::Manager;
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

fn main() {
    tauri::Builder::default()
        .manage(ghost_state())
        .manage(aegis::aegis_state())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            tray::setup_tray(app.handle())?;
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
        // Sprint 20.0: Belt-and-suspenders Ghost shutdown on window close.
        // Primary path: TypeScript beforeunload → POST /api/ghost/stop (JS-side lifecycle).
        // Suspenders: Destroyed event → stop Rust-side watcher directly via managed state.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Chain state() + lock() + stop() in one expression so no
                // intermediate borrow outlives its owner (avoids E0597).
                let app = window.app_handle().clone();
                let _ = app.state::<ghost::GhostState>().lock().map(|mut w| w.stop());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
