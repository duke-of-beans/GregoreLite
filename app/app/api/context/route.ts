/**
 * GET /api/context
 *
 * Aggregates KERNL state for the ContextPanel UI.
 * Runs server-side so better-sqlite3 is accessible.
 * Returns ContextPanelState — polled every 30s by context-provider.ts.
 */

import { NextResponse } from 'next/server';
import {
  getActiveProject,
  listDecisions,
  listThreads,
  getLatestAegisSignal,
} from '@/lib/kernl';
import type { ContextPanelState } from '@/lib/context/types';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    // Active project — most recently updated active project
    const activeProject = getActiveProject();

    // Session number = total thread count in KERNL
    const threads = listThreads(1000);
    const sessionNumber = threads.length;

    // Session duration = ms elapsed since most recent thread's created_at
    const latestThread = threads[0] ?? null;
    const sessionDurationMs = latestThread
      ? Date.now() - latestThread.created_at
      : 0;

    // Recent decisions — last 5 across all threads
    const recentDecisions = listDecisions({ limit: 5 });

    // KERNL index status — always 'indexed' until background indexing lands (Phase 3)
    const kernlStatus: ContextPanelState['kernlStatus'] = 'indexed';

    // AEGIS profile — latest signal row, or IDLE if none
    const latestSignal = getLatestAegisSignal();
    const aegisProfile = latestSignal?.profile ?? 'IDLE';

    // AEGIS online state — stubbed false until Sprint 2C wires getAEGISStatus()
    const aegisOnline = false;

    const state: ContextPanelState = {
      activeProject: activeProject
        ? {
            id: activeProject.id,
            name: activeProject.name,
            path: activeProject.path ?? null,
          }
        : null,
      sessionNumber,
      sessionDurationMs,
      recentDecisions: recentDecisions.map((d) => ({
        id: d.id,
        title: d.title,
        created_at: d.created_at,
      })),
      kernlStatus,
      aegisProfile,
      aegisOnline,
      pendingSuggestions: 0,
    };

    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error('[api/context] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load context' },
      { status: 500 }
    );
  }
}
