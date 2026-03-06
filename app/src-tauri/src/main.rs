// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aegis;
mod ghost;
mod notifications;
mod tray;

use aegis::{
    aegis_cancel_timer, aegis_list_profiles, aegis_metrics, aegis_set_timer, aegis_status,
    aegis_switch_profile,
};
use ghost::{
    ghost_pause, ghost_resume, ghost_start_watching, ghost_state, ghost_stop_watching,
};
use notifications::send_notification;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
