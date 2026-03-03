// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ghost;
mod notifications;
mod tray;

use ghost::{
    ghost_pause, ghost_resume, ghost_start_watching, ghost_state, ghost_stop_watching,
};
use notifications::send_notification;
use tray::set_tray_badge;

fn main() {
    tauri::Builder::default()
        .manage(ghost_state())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
