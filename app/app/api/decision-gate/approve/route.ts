/**
 * POST /api/decision-gate/approve
 *
 * David approves the active gate. Writes to KERNL decisions table
 * and releases the decision_lock so the next /api/chat call succeeds.
 *
 * Body: { threadId: string; trigger: GateTrigger; rationale?: string }
 * Returns: { released: true }
 */

import type { NextRequest } from 'next/server';
import { logGateApproval } from '@/lib/decision-gate/kernl-logger';
import type { GateTrigger } from '@/lib/decision-gate';

interface ApproveBody {
  threadId: string;
  trigger: GateTrigger;
  rationale?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: ApproveBody;

  try {
    body = (await request.json()) as ApproveBody;
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

  logGateApproval(threadId, trigger, 'approved', rationale);

  return new Response(
    JSON.stringify({ released: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
