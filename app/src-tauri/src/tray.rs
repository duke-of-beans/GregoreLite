// System Tray — Sprint S9-15
// Registers tray icon with Show/Hide and Exit menu items.
// Badge count is reflected in tooltip text (Windows limitation).

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};
use std::sync::atomic::{AtomicU32, Ordering};

static BADGE_COUNT: AtomicU32 = AtomicU32::new(0);

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_hide = MenuItemBuilder::with_id("show_hide", "Show / Hide")
        .build(app)?;
    let exit = MenuItemBuilder::with_id("exit", "Exit")
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_hide)
        .separator()
        .item(&exit)
        .build()?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Gregore Lite")
        .icon(app.default_window_icon().cloned().unwrap_or_else(|| {
            tauri::image::Image::new(&[], 0, 0)
        }))
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show_hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                "exit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Update the badge count shown in tray tooltip.
#[tauri::command]
pub async fn set_tray_badge(count: u32, app: AppHandle) -> Result<(), String> {
    BADGE_COUNT.store(count, Ordering::Relaxed);
    // Update tooltip to reflect badge
    let tooltip = if count == 0 {
        "Gregore Lite".to_string()
    } else {
        format!("Gregore Lite ({} notification{})", count, if count == 1 { "" } else { "s" })
    };
    // Get tray icon by id and update tooltip
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(&tooltip)).map_err(|e| format!("tooltip: {e}"))?;
    }
    Ok(())
}
