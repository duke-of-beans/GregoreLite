// Native Notifications — Sprint S9-15
// IPC command that sends a Windows native toast notification via tauri-plugin-notification.

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

/// Send a native OS notification (Windows toast).
/// Called from TypeScript tray-bridge when escalate: true.
#[tauri::command]
pub async fn send_notification(
    title: String,
    body: String,
    _urgency: String,
    app: AppHandle,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("notification failed: {e}"))
}
