/**
 * lib/recall/scheduler.ts — Ambient Memory: detection + surface scheduler
 * Sprint 27.0
 *
 * Two timers (both .unref() so they don't prevent Node.js exit):
 *   - Detection: runs runRecallDetection() every N hours (default 2h)
 *   - Surface: picks next unsurfaced event every 30 minutes
 *
 * Lifecycle: start after Ghost starts, stop on Ghost shutdown.
 */

import { runRecallDetection } from './detector';
import {
  loadUserHistory,
  scoreRecallEvent,
  isEligibleToSurface,
  getRecallCalibration,
  applyCalibration,
  storeRecallEvents,
  surfaceNextEvent,
} from './scorer';
import { getDatabase } from '@/lib/kernl/database';
import type { RecallEvent, RecallSchedulerSettings } from './types';
import { DEFAULT_RECALL_SETTINGS } from './types';

// ── State ─────────────────────────────────────────────────────────────────────

let _detectionTimer: ReturnType<typeof setInterval> | null = null;
let _surfaceTimer:   ReturnType<typeof setInterval> | null = null;
let _running = false;
let _paused  = false;

const SURFACE_INTERVAL_MS = 30 * 60 * 1000;

// ── Settings ──────────────────────────────────────────────────────────────────

function loadSettings(): RecallSchedulerSettings {
  try {
    const db = getDatabase();
    const row = db
      .prepare(`SELECT value FROM kernl_settings WHERE key = 'recall_settings' LIMIT 1`)
      .get() as { value: string } | undefined;
    if (row?.value) {
      return { ...DEFAULT_RECALL_SETTINGS, ...(JSON.parse(row.value) as Partial<RecallSchedulerSettings>) };
    }
  } catch { /* fallback */ }
  return DEFAULT_RECALL_SETTINGS;
}

function saveSettings(settings: RecallSchedulerSettings): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO kernl_settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run('recall_settings', JSON.stringify(settings), Date.now());
  } catch { /* best effort */ }
}

// ── Detection run ─────────────────────────────────────────────────────────────

async function runDetection(): Promise<void> {
  if (_paused) return;
  const settings = loadSettings();
  if (!settings.enabled) return;

  try {
    console.log('[recall/scheduler] Running detection...');
    const rawEvents = await runRecallDetection(settings);
    if (rawEvents.length === 0) return;

    const history = loadUserHistory();
    const db = getDatabase();

    type SurfacedRow = { type: string };
    const recentSurfaced = db.prepare<[number], SurfacedRow>(`
      SELECT DISTINCT type FROM recall_events
      WHERE surfaced_at IS NOT NULL AND surfaced_at > ?
      LIMIT 5
    `).all(Date.now() - 24 * 60 * 60 * 1000) as SurfacedRow[];
    const recentTypes = recentSurfaced.map((r) => r.type as RecallEvent['type']);

    const eligible = rawEvents
      .map((e) => ({ ...e, relevance_score: scoreRecallEvent(e, history, recentTypes) }))
      .filter((e) => isEligibleToSurface(e.relevance_score))
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 5);

    storeRecallEvents(eligible);
    console.log(`[recall/scheduler] Stored ${eligible.length} events`);

    const calibration = getRecallCalibration(history);
    if (calibration.autoReduced) {
      const updated = applyCalibration(settings, calibration);
      if (updated.detectionIntervalHours !== settings.detectionIntervalHours) {
        console.log(`[recall/scheduler] Auto-reducing interval: ${settings.detectionIntervalHours}h → ${updated.detectionIntervalHours}h`);
        saveSettings(updated);
        restartDetectionTimer(updated.detectionIntervalHours);
      }
    }
  } catch (err) {
    console.error('[recall/scheduler] Detection failed:', err);
  }
}

function runSurface(): void {
  if (_paused) return;
  const settings = loadSettings();
  if (!settings.enabled) return;
  try {
    const surfaced = surfaceNextEvent(settings.maxPerDay);
    if (surfaced) console.log(`[recall/scheduler] Surfaced: "${surfaced.message.slice(0, 60)}"`);
  } catch (err) {
    console.error('[recall/scheduler] Surface failed:', err);
  }
}

// ── Timer management ──────────────────────────────────────────────────────────

function restartDetectionTimer(intervalHours: number): void {
  if (_detectionTimer) clearInterval(_detectionTimer);
  _detectionTimer = setInterval(() => { void runDetection(); }, intervalHours * 60 * 60 * 1000);
  _detectionTimer.unref();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startRecallScheduler(): Promise<void> {
  if (_running) return;
  const settings = loadSettings();
  if (!settings.enabled) {
    console.log('[recall/scheduler] Disabled — not starting');
    return;
  }

  _running = true;
  _paused  = false;
  console.log(`[recall/scheduler] Starting (${settings.detectionIntervalHours}h detection, ${settings.maxPerDay}/day max)`);

  // Initial runs after a short settle delay
  setTimeout(() => { void runDetection(); }, 10_000).unref();
  setTimeout(runSurface, 5_000).unref();

  restartDetectionTimer(settings.detectionIntervalHours);
  _surfaceTimer = setInterval(runSurface, SURFACE_INTERVAL_MS);
  _surfaceTimer.unref();
}

export function stopRecallScheduler(): void {
  if (!_running) return;
  if (_detectionTimer) { clearInterval(_detectionTimer); _detectionTimer = null; }
  if (_surfaceTimer)   { clearInterval(_surfaceTimer);   _surfaceTimer   = null; }
  _running = false;
  _paused  = false;
  console.log('[recall/scheduler] Stopped');
}

export function pauseRecallScheduler(): void {
  _paused = true;
  console.log('[recall/scheduler] Paused');
}

export function resumeRecallScheduler(): void {
  _paused = false;
  console.log('[recall/scheduler] Resumed');
}

export function isRecallSchedulerRunning(): boolean {
  return _running;
}
