/**
 * POST /api/decision-gate/policy
 *
 * Create an override policy for a decision gate trigger.
 * Called from GatePanel when the user selects a bypass scope before proceeding.
 *
 * Body: { trigger: GateTrigger; scope: 'once' | 'category' | 'always'; category?: string }
 * Returns: { policy: OverridePolicy }
 */

import type { NextRequest } from 'next/server';
import { createPolicy } from '@/lib/decision-gate/override-policies';
import type { GateTrigger } from '@/lib/decision-gate';

interface PolicyBody {
  trigger: GateTrigger;
  scope: 'once' | 'category' | 'always';
  category?: string;
}

const VALID_SCOPES = new Set(['once', 'category', 'always']);

export async function POST(request: NextRequest): Promise<Response> {
  let body: PolicyBody;

  try {
    body = (await request.json()) as PolicyBody;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { trigger, scope, category } = body;

  if (!trigger || !scope) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: trigger, scope' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!VALID_SCOPES.has(scope)) {
    return new Response(
      JSON.stringify({ error: 'scope must be one of: once, category, always' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const policy = createPolicy(trigger, scope, category);
    return new Response(
      JSON.stringify({ policy }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
