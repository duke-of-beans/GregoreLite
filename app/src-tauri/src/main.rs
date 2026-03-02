// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ghost;

use ghost::{
    ghost_pause, ghost_resume, ghost_start_watching, ghost_state, ghost_stop_watching,
};

fn main() {
    tauri::Builder::default()
        .manage(ghost_state())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            ghost_start_watching,
            ghost_stop_watching,
            ghost_pause,
            ghost_resume,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
