/**
 * GET  /api/transit/insights          — list insights (optional ?status= filter)
 * POST /api/transit/insights          — actions: approve | dismiss | rollback | run_pipeline
 *
 * Sprint 11.7 — Transit Map Learning Engine API
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getAllInsights,
  getInsightsByStatus,
  applyInsight,
  dismissInsight,
  rollbackInsight,
  runLearningPipeline,
} from '@/lib/transit/learning';
import type { InsightStatus } from '@/lib/transit/learning/types';

// ── GET ───────────────────────────────────────────────────────────────────────

export function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') as InsightStatus | null;
    const insights = status ? getInsightsByStatus(status) : getAllInsights();
    return NextResponse.json({ insights });
  } catch (err) {
    console.warn('[transit/insights] GET failed:', err);
    return NextResponse.json({ error: 'Failed to load insights' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

interface PostBody {
  action: 'approve' | 'dismiss' | 'rollback' | 'run_pipeline';
  insightId?: string;
  afterState?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PostBody;
    const { action, insightId, afterState } = body;

    switch (action) {
      case 'approve': {
        if (!insightId) {
          return NextResponse.json({ error: 'insightId required for approve' }, { status: 400 });
        }
        // Human approval gate: mark as applied with a lightweight state snapshot.
        // The actual system config change is applied externally by the caller.
        const snapshot = afterState ?? JSON.stringify({ approved_at: Date.now() });
        applyInsight(insightId, snapshot);
        return NextResponse.json({ success: true });
      }

      case 'dismiss': {
        if (!insightId) {
          return NextResponse.json({ error: 'insightId required for dismiss' }, { status: 400 });
        }
        dismissInsight(insightId);
        return NextResponse.json({ success: true });
      }

      case 'rollback': {
        if (!insightId) {
          return NextResponse.json({ error: 'insightId required for rollback' }, { status: 400 });
        }
        const { beforeState } = rollbackInsight(insightId);
        // Return beforeState so the UI (or caller) can restore the previous config
        return NextResponse.json({ success: true, beforeState });
      }

      case 'run_pipeline': {
        // Pipeline has full internal error isolation — safe to await
        const results = await runLearningPipeline();
        return NextResponse.json({ success: true, pipelineResults: results });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${String(action)}` },
          { status: 400 },
        );
    }
  } catch (err) {
    console.warn('[transit/insights] POST failed:', err);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
