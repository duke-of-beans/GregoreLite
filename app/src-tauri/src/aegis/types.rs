// AEGIS types — Sprint 16.0
// Ported from D:\Dev\aegis\src\config\types.ts
// All types needed for resource monitoring, profiles, and IPC responses.

use serde::{Deserialize, Serialize};

// ── Priority enums ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CpuPriority {
    High,
    AboveNormal,
    Normal,
    BelowNormal,
    Idle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IoPriority {
    High,
    Normal,
    Low,
    Background,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryPriority {
    High,
    AboveNormal,
    Normal,
    BelowNormal,
    Idle,
}

// ── Process management ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessEntry {
    pub name: String,
    pub cpu_priority: CpuPriority,
    pub io_priority: IoPriority,
    pub memory_priority: MemoryPriority,
    pub cpu_affinity: Option<String>,
    pub disable_power_throttling: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QosEntry {
    pub app: String,
    pub priority: String,
    pub dscp: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchdogEntry {
    pub process: String,
    pub restart_on_crash: bool,
    pub restart_delay_sec: u64,
    pub max_restarts: u32,
    pub backoff: String,
    pub pre_restart_script: Option<String>,
    pub post_restart_script: Option<String>,
}

// ── Memory and system config ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub trim_background_working_sets: bool,
    pub trim_interval_min: u64,
    pub low_memory_threshold_mb: u64,
    pub preflight_trim_on_activate: bool,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            trim_background_working_sets: false,
            trim_interval_min: 5,
            low_memory_threshold_mb: 512,
            preflight_trim_on_activate: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfig {
    pub purge_standby_memory: bool,
    pub standby_purge_interval_min: u64,
    pub reenforce_priorities: bool,
    pub reenforce_interval_sec: u64,
    pub pause_services: Vec<String>,
    pub disable_power_throttling: bool,
    pub flush_temp_on_activate: bool,
}

impl Default for SystemConfig {
    fn default() -> Self {
        Self {
            purge_standby_memory: false,
            standby_purge_interval_min: 10,
            reenforce_priorities: false,
            reenforce_interval_sec: 30,
            pause_services: vec![],
            disable_power_throttling: false,
            flush_temp_on_activate: false,
        }
    }
}

// ── Auto-detection ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoDetectTrigger {
    pub process: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoDetectRule {
    pub triggers: Vec<AutoDetectTrigger>,
    pub require_all: bool,
    pub mode: String,
}

// ── Profile ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileDefinition {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub icon: String,
    pub color: String,
    pub power_plan: String,
    #[serde(default)]
    pub auto_detect: Option<AutoDetectRule>,
    #[serde(default)]
    pub elevated_processes: Vec<ProcessEntry>,
    #[serde(default)]
    pub throttled_processes: Vec<ProcessEntry>,
    #[serde(default)]
    pub network_qos: Vec<QosEntry>,
    #[serde(default)]
    pub watchdog: Vec<WatchdogEntry>,
    #[serde(default)]
    pub memory: MemoryConfig,
    #[serde(default)]
    pub system: SystemConfig,
}

// ── Timer state ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerState {
    pub active: bool,
    pub target_profile: Option<String>,
    pub return_profile: Option<String>,
    pub started_at: Option<String>,
    pub duration_min: Option<f64>,
    pub expires_at: Option<String>,
}

impl Default for TimerState {
    fn default() -> Self {
        Self {
            active: false,
            target_profile: None,
            return_profile: None,
            started_at: None,
            duration_min: None,
            expires_at: None,
        }
    }
}

// ── System snapshot (IPC response) ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub timestamp: String,
    pub cpu_percent: f64,
    pub memory_percent: f64,
    pub memory_mb_used: u64,
    pub memory_mb_available: u64,
    pub power_plan: String,
}

impl Default for SystemMetrics {
    fn default() -> Self {
        Self {
            timestamp: String::new(),
            cpu_percent: 0.0,
            memory_percent: 0.0,
            memory_mb_used: 0,
            memory_mb_available: 0,
            power_plan: String::new(),
        }
    }
}

// ── AEGIS status (IPC response) ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AegisStatus {
    pub active_profile: String,
    pub active_profile_display: String,
    pub active_profile_color: String,
    pub profiles: Vec<ProfileSummary>,
    pub timer: TimerState,
    pub metrics: SystemMetrics,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileSummary {
    pub name: String,
    pub display_name: String,
    pub color: String,
    pub description: String,
    pub is_active: bool,
}
