// AEGIS Metrics Collector — Sprint 16.0
// Replaces status/collector.ts + worker IPC get_system_stats.
// Uses sysinfo crate for direct CPU/memory polling — no child process needed.

use std::sync::Mutex;
use sysinfo::System;

use super::types::SystemMetrics;

pub struct MetricsCollector {
    system: Mutex<System>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        let mut sys = System::new();
        sys.refresh_memory();
        sys.refresh_cpu_usage();
        Self {
            system: Mutex::new(sys),
        }
    }

    /// Refresh and return current system metrics.
    /// Called by the aegis_metrics Tauri command.
    pub fn snapshot(&self) -> SystemMetrics {
        let mut sys = self.system.lock().unwrap();
        sys.refresh_memory();
        sys.refresh_cpu_usage();

        // sysinfo reports per-CPU usage; average across all cores
        let cpu_count = sys.cpus().len() as f64;
        let cpu_total: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum();
        let cpu_percent = if cpu_count > 0.0 {
            cpu_total / cpu_count
        } else {
            0.0
        };

        let total_mem = sys.total_memory(); // bytes
        let used_mem = sys.used_memory();   // bytes
        let available_mem = sys.available_memory();

        let mem_percent = if total_mem > 0 {
            (used_mem as f64 / total_mem as f64) * 100.0
        } else {
            0.0
        };

        SystemMetrics {
            timestamp: chrono::Utc::now().to_rfc3339(),
            cpu_percent: (cpu_percent * 10.0).round() / 10.0,
            memory_percent: (mem_percent * 10.0).round() / 10.0,
            memory_mb_used: used_mem / (1024 * 1024),
            memory_mb_available: available_mem / (1024 * 1024),
            power_plan: String::new(), // TODO: read active power plan via powercfg
        }
    }
}
