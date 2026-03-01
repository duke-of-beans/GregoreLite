/**
 * Tests for lib/kernl/project-store.ts and aegis-store.ts
 *
 * better-sqlite3 native binary cannot load inside Vitest's child process
 * (pnpm + Tauri native module build context). The database module is mocked
 * with an in-memory store so we can test project-store / aegis-store logic
 * without the native dependency.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── In-memory tables (reset in beforeEach) ────────────────────────────────────
let _projects: Record<string, unknown>[] = [];
let _aegis: Record<string, unknown>[] = [];

function makePrepared(sql: string) {
  const up = sql.trimStart().toUpperCase();
  const isInsert = up.startsWith('INSERT');
  const isUpdate = up.startsWith('UPDATE');

  return {
    run: (...params: unknown[]) => {
      if (sql.includes('projects')) {
        if (isInsert && sql.includes('ON CONFLICT')) {
          // upsertProject — insert or update name/path
          const [id, name, path, , created_at, updated_at] = params as [string,string,string,string,number,number];
          const idx = _projects.findIndex((p) => p.id === id);
          if (idx >= 0) {
            const existing = _projects[idx]!;
            _projects[idx] = { ...existing, name, path: path ?? existing.path, updated_at };
          } else {
            _projects.push({ id, name, path, status: 'active', description: null, meta: null, created_at, updated_at });
          }
        } else if (isInsert) {
          // 'active' is hardcoded in the SQL VALUES — params are 7: id,name,path,description,created_at,updated_at,meta
          const [id, name, path, description, created_at, updated_at, meta] = params as [string,string,string|null,string|null,number,number,string|null];
          _projects.push({ id, name, path, description, status: 'active', created_at, updated_at, meta });
        } else if (isUpdate) {
          const [updated_at, id] = params as [number, string];
          const p = _projects.find((r) => r.id === id);
          if (p) p.updated_at = updated_at;
        }
      } else if (sql.includes('aegis_signals')) {
        const [id, profile, source_thread, sent_at, is_override] = params as [string,string,string|null,number,number];
        _aegis.push({ id, profile, source_thread, sent_at, is_override });
      }
      return { changes: 1 };
    },

    get: (...params: unknown[]) => {
      if (sql.includes('projects')) {
        if (sql.includes('WHERE id = ?')) {
          return _projects.find((p) => p.id === params[0]) ?? undefined;
        }
        if (sql.includes("status = 'active'")) {
          return [..._projects]
            .filter((p) => p.status === 'active')
            .sort((a, b) => (b.updated_at as number) - (a.updated_at as number))[0] ?? undefined;
        }
      }
      if (sql.includes('aegis_signals')) {
        return [..._aegis].sort((a, b) => (b.sent_at as number) - (a.sent_at as number))[0] ?? undefined;
      }
      return undefined;
    },

    all: (...params: unknown[]) => {
      if (sql.includes('projects')) {
        const rows = sql.includes('status = ?')
          ? _projects.filter((p) => p.status === params[0])
          : [..._projects];
        return rows.sort((a, b) => (b.updated_at as number) - (a.updated_at as number));
      }
      return [];
    },
  };
}

// ── Mock database module before any KERNL imports ─────────────────────────────
vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: (sql: string) => makePrepared(sql),
  }),
  closeDatabase: vi.fn(),
}));

// Imports must come AFTER vi.mock() declarations
import {
  createProject,
  getProject,
  listProjects,
  getActiveProject,
  upsertProject,
} from '@/lib/kernl/project-store';
import { logAegisSignal, getLatestAegisSignal } from '@/lib/kernl/aegis-store';

beforeEach(() => {
  _projects = [];
  _aegis = [];
});

// ─── project-store ────────────────────────────────────────────────────────────

describe('project-store', () => {
  it('createProject returns a project with correct fields', () => {
    const p = createProject({ name: 'GregLite', path: 'D:\\Projects\\GregLite' });
    expect(p.id).toBeTruthy();
    expect(p.name).toBe('GregLite');
    expect(p.path).toBe('D:\\Projects\\GregLite');
    expect(p.status).toBe('active');
  });

  it('getProject returns null for unknown id', () => {
    expect(getProject('no-such-id')).toBeNull();
  });

  it('getProject returns the project after creation', () => {
    const p = createProject({ name: 'Alpha' });
    expect(getProject(p.id)?.name).toBe('Alpha');
  });

  it('listProjects returns all created projects', () => {
    createProject({ name: 'Alpha' });
    createProject({ name: 'Beta' });
    expect(listProjects().length).toBeGreaterThanOrEqual(2);
  });

  it('getActiveProject returns the most recently updated project', async () => {
    createProject({ name: 'First' });
    await new Promise((r) => setTimeout(r, 5));
    createProject({ name: 'Second' });
    expect(getActiveProject()?.name).toBe('Second');
  });

  it('getActiveProject returns null when no projects exist', () => {
    expect(getActiveProject()).toBeNull();
  });

  it('upsertProject creates project on first call', () => {
    const p = upsertProject('fixed-id', 'Original', 'D:\\Orig');
    expect(p.id).toBe('fixed-id');
    expect(p.name).toBe('Original');
  });

  it('upsertProject updates existing project on second call', () => {
    upsertProject('uid', 'V1', 'D:\\V1');
    upsertProject('uid', 'V2', 'D:\\V2');
    expect(getProject('uid')?.name).toBe('V2');
  });
});

// ─── aegis-store ─────────────────────────────────────────────────────────────

describe('aegis-store', () => {
  it('getLatestAegisSignal returns null when no signals exist', () => {
    expect(getLatestAegisSignal()).toBeNull();
  });

  it('logAegisSignal returns the inserted signal', () => {
    const s = logAegisSignal('DEEP_FOCUS');
    expect(s.profile).toBe('DEEP_FOCUS');
    expect(s.is_override).toBe(0);
  });

  it('getLatestAegisSignal returns most recent signal', async () => {
    logAegisSignal('IDLE');
    await new Promise((r) => setTimeout(r, 5));
    logAegisSignal('SPRINT_MODE');
    expect(getLatestAegisSignal()?.profile).toBe('SPRINT_MODE');
  });

  it('logAegisSignal sets is_override flag correctly', () => {
    logAegisSignal('EMERGENCY', undefined, true);
    expect(getLatestAegisSignal()?.is_override).toBe(1);
  });

  it('logAegisSignal records source_thread when provided', () => {
    logAegisSignal('FOCUS', 'thread-abc');
    expect(getLatestAegisSignal()?.source_thread).toBe('thread-abc');
  });
});
