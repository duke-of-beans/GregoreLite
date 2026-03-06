// AEGIS Module — Sprint 16.0
// Resource monitoring + profile engine, embedded in Tauri backend.
// No separate service, no HTTP, no port 8743. One app, one process.
//
// Tauri commands:
//   aegis_status         → full status snapshot (profile + metrics + timer)
//   aegis_switch_profile → switch to a named profile
//   aegis_metrics        → lightweight CPU/memory snapshot only
//   aegis_list_profiles  → list all available profiles
//   aegis_set_timer      → start a timed profile switch
//   aegis_cancel_timer   → cancel the active timer

pub mod metrics;
pub mod profiles;
pub mod timer;
pub mod types;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::State;

use metrics::MetricsCollector;
use profiles::ProfileEngine;
use timer::ProfileTimer;
use types::{AegisStatus, ProfileSummary, SystemMetrics, TimerState};

// ── Tauri managed state ───────────────────────────────────────────────────────

pub struct AegisState {
    pub profiles: Mutex<ProfileEngine>,
    pub metrics: MetricsCollector,
    pub timer: Mutex<ProfileTimer>,
}

/// Build initial AEGIS state. Called from main.rs during Tauri setup.
/// Reads profile YAML files from %APPDATA%\AEGIS\profiles\.
/// Falls back gracefully if the directory doesn't exist (no profiles loaded).
pub fn aegis_state() -> AegisState {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| "C:\\Users\\Public".into());
    let profiles_dir = PathBuf::from(&appdata).join("AEGIS").join("profiles");

    // Default config — matches aegis-config.yaml defaults
    let default_profile = "idle".to_string();
    let profile_order = vec![
        "idle".into(),
        "deep-research".into(),
        "performance".into(),
        "build-mode".into(),
        "wartime".into(),
    ];

    let mut engine = ProfileEngine::new(profiles_dir, default_profile, profile_order);
    if let Err(e) = engine.load() {
        eprintln!("[aegis] Profile load warning: {e}");
        // Non-fatal — app works without profiles
    }

    AegisState {
        profiles: Mutex::new(engine),
        metrics: MetricsCollector::new(),
        timer: Mutex::new(ProfileTimer::new()),
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Full AEGIS status: active profile, all profiles, timer, metrics.
#[tauri::command]
pub async fn aegis_status(state: State<'_, AegisState>) -> Result<AegisStatus, String> {
    let profiles = state.profiles.lock().map_err(|e| format!("lock: {e}"))?;
    let timer = state.timer.lock().map_err(|e| format!("lock: {e}"))?;
    let metrics = state.metrics.snapshot();

    let active = profiles.active();
    let (display, color) = match active {
        Some(p) => (p.display_name.clone(), p.color.clone()),
        None => ("None".into(), "#888".into()),
    };

    Ok(AegisStatus {
        active_profile: profiles.active_name().to_string(),
        active_profile_display: display,
        active_profile_color: color,
        profiles: profiles.summaries(),
        timer: timer.to_state(),
        metrics,
        version: "2.0.0".into(),
    })
}

/// Switch to a different AEGIS profile by name.
#[tauri::command]
pub async fn aegis_switch_profile(
    name: String,
    state: State<'_, AegisState>,
) -> Result<String, String> {
    let mut profiles = state.profiles.lock().map_err(|e| format!("lock: {e}"))?;
    let profile = profiles.switch(&name)?;
    Ok(profile.display_name.clone())
}

/// Lightweight metrics-only snapshot (no profile or timer data).
#[tauri::command]
pub async fn aegis_metrics(state: State<'_, AegisState>) -> Result<SystemMetrics, String> {
    Ok(state.metrics.snapshot())
}

/// List all available profiles.
#[tauri::command]
pub async fn aegis_list_profiles(
    state: State<'_, AegisState>,
) -> Result<Vec<ProfileSummary>, String> {
    let profiles = state.profiles.lock().map_err(|e| format!("lock: {e}"))?;
    Ok(profiles.summaries())
}

/// Start a timed profile switch.
#[tauri::command]
pub async fn aegis_set_timer(
    target_profile: String,
    return_profile: String,
    duration_min: f64,
    state: State<'_, AegisState>,
) -> Result<TimerState, String> {
    let mut timer = state.timer.lock().map_err(|e| format!("lock: {e}"))?;
    timer.start(target_profile, return_profile, duration_min);
    Ok(timer.to_state())
}

/// Cancel the active timer.
#[tauri::command]
pub async fn aegis_cancel_timer(state: State<'_, AegisState>) -> Result<(), String> {
    let mut timer = state.timer.lock().map_err(|e| format!("lock: {e}"))?;
    timer.cancel();
    Ok(())
}
