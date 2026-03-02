/**
 * POST /api/decision-gate/override
 *
 * David overrides a mandatory gate (dismissCount >= 3).
 * Requires a written rationale of at least 20 characters.
 * Writes to KERNL decisions table and releases the lock.
 *
 * Body: { threadId: string; trigger: GateTrigger; rationale: string }
 * Returns: { released: true }
 */

import type { NextRequest } from 'next/server';
import { logGateApproval } from '@/lib/decision-gate/kernl-logger';
import type { GateTrigger } from '@/lib/decision-gate';

interface OverrideBody {
  threadId: string;
  trigger: GateTrigger;
  rationale: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: OverrideBody;

  try {
    body = (await request.json()) as OverrideBody;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { threadId, trigger, rationale } = body;

  if (!threadId || !trigger) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: threadId, trigger' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!rationale || rationale.trim().length < 20) {
    return new Response(
      JSON.stringify({ error: 'Override rationale must be at least 20 characters' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  logGateApproval(threadId, trigger, 'overridden', rationale.trim());

  return new Response(
    JSON.stringify({ released: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
