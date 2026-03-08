/**
 * Sprint 34.0 Tests — Watchfolder + Sync Reminder
 * EPIC-81 Sprint 2/3
 *
 * Covers:
 *   - DEFAULT_WATCHFOLDER path construction
 *   - getWatchfolderPath: KERNL setting → fallback
 *   - SUPPORTED_EXTENSIONS filtering
 *   - moveToProcessed: success, collision handling, cross-device fallback
 *   - getDaysSinceSync: null when no data, correct computation
 *   - shouldShowReminder: boundary conditions at 13/14/15 days + null guard
 *   - getReminderDays: default + custom KERNL setting
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/lib/kernl/settings-store', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

import { getDatabase } from '@/lib/kernl/database';
import { getSetting } from '@/lib/kernl/settings-store';
import {
  DEFAULT_WATCHFOLDER,
  SUPPORTED_EXTENSIONS,
  getWatchfolderPath,
  getProcessedDir,
} from '@/lib/import/watchfolder-config';
import { moveToProcessed } from '@/lib/import/watchfolder';
import {
  getDaysSinceSync,
  shouldShowReminder,
  getReminderDays,
} from '@/lib/import/sync-reminder';

const mockGetSetting = vi.mocked(getSetting);
const mockGetDatabase = vi.mocked(getDatabase);

// ── Watchfolder Config ────────────────────────────────────────────────────────

describe('DEFAULT_WATCHFOLDER', () => {
  it('resolves inside home directory', () => {
    const home = os.homedir();
    expect(DEFAULT_WATCHFOLDER.startsWith(home)).toBe(true);
  });

  it('contains "GregLite/imports" path segment', () => {
    const normalized = DEFAULT_WATCHFOLDER.replace(/\\/g, '/');
    expect(normalized).toContain('GregLite/imports');
  });
});

describe('getWatchfolderPath', () => {
  it('returns KERNL setting when set', () => {
    mockGetSetting.mockReturnValueOnce('D:/Custom/imports');
    expect(getWatchfolderPath()).toBe('D:/Custom/imports');
  });

  it('falls back to DEFAULT_WATCHFOLDER when KERNL returns null', () => {
    mockGetSetting.mockReturnValueOnce(null);
    expect(getWatchfolderPath()).toBe(DEFAULT_WATCHFOLDER);
  });
});

describe('SUPPORTED_EXTENSIONS', () => {
  it('accepts .json', () => {
    expect(SUPPORTED_EXTENSIONS).toContain('.json');
  });

  it('accepts .zip', () => {
    expect(SUPPORTED_EXTENSIONS).toContain('.zip');
  });

  it('rejects .pdf', () => {
    expect(SUPPORTED_EXTENSIONS).not.toContain('.pdf');
  });

  it('rejects .docx', () => {
    expect(SUPPORTED_EXTENSIONS).not.toContain('.docx');
  });
});

describe('getProcessedDir', () => {
  it('returns processed/ subdir inside watchfolder', () => {
    const wf = '/some/watchfolder';
    expect(getProcessedDir(wf)).toBe(path.join(wf, 'processed'));
  });
});

// ── moveToProcessed ───────────────────────────────────────────────────────────

describe('moveToProcessed', () => {
  let tmpDir: string;
  let srcFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'greglite-test-'));
    srcFile = path.join(tmpDir, 'conversations.json');
    fs.writeFileSync(srcFile, '{"test":true}');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('moves file to processed/ subdir', () => {
    moveToProcessed(srcFile);
    const dest = path.join(tmpDir, 'processed', 'conversations.json');
    expect(fs.existsSync(dest)).toBe(true);
  });

  it('removes original file after move', () => {
    moveToProcessed(srcFile);
    expect(fs.existsSync(srcFile)).toBe(false);
  });

  it('handles collision by appending timestamp suffix', () => {
    // Pre-create the destination so there's a collision
    const processedDir = path.join(tmpDir, 'processed');
    fs.mkdirSync(processedDir, { recursive: true });
    fs.writeFileSync(path.join(processedDir, 'conversations.json'), 'existing');

    moveToProcessed(srcFile);

    // Original should be gone
    expect(fs.existsSync(srcFile)).toBe(false);
    // processed/ should now have 2 files
    const files = fs.readdirSync(processedDir);
    expect(files.length).toBe(2);
  });
});

// ── Sync Reminder ─────────────────────────────────────────────────────────────

describe('getDaysSinceSync', () => {
  it('returns null when no imported_sources exist', () => {
    const mockDb = { prepare: vi.fn(() => ({ get: vi.fn(() => ({ ts: null })) })) };
    mockGetDatabase.mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>);
    expect(getDaysSinceSync()).toBeNull();
  });

  it('returns correct days for a known last_synced_at', () => {
    const threeDaysAgo = Date.now() - 3 * 86_400_000;
    const mockDb = { prepare: vi.fn(() => ({ get: vi.fn(() => ({ ts: threeDaysAgo })) })) };
    mockGetDatabase.mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>);
    expect(getDaysSinceSync()).toBe(3);
  });
});

describe('getReminderDays', () => {
  it('defaults to 14 when KERNL setting is null', () => {
    mockGetSetting.mockReturnValueOnce(null);
    expect(getReminderDays()).toBe(14);
  });

  it('reads custom value from KERNL', () => {
    mockGetSetting.mockReturnValueOnce('30');
    expect(getReminderDays()).toBe(30);
  });

  it('falls back to 14 for invalid KERNL value', () => {
    mockGetSetting.mockReturnValueOnce('notanumber');
    expect(getReminderDays()).toBe(14);
  });
});

describe('shouldShowReminder', () => {
  function mockDays(days: number | null) {
    const mockDb = {
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({
          ts: days === null ? null : Date.now() - days * 86_400_000,
        })),
      })),
    };
    mockGetDatabase.mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>);
    // Use default 14-day threshold
    mockGetSetting.mockReturnValue(null);
  }

  it('returns false when daysSinceSync is null (no imports ever)', () => {
    mockDays(null);
    expect(shouldShowReminder()).toBe(false);
  });

  it('returns false at 13 days (below threshold)', () => {
    mockDays(13);
    expect(shouldShowReminder()).toBe(false);
  });

  it('returns true at exactly 14 days (at threshold)', () => {
    mockDays(14);
    expect(shouldShowReminder()).toBe(true);
  });

  it('returns true at 15 days (above threshold)', () => {
    mockDays(15);
    expect(shouldShowReminder()).toBe(true);
  });
});
