/**
 * GET  /api/decision-gate/policies  — list all override policies
 * DELETE /api/decision-gate/policies — delete all policies (reset)
 */

import { NextResponse } from 'next/server';
import { getPolicies, deleteAllPolicies } from '@/lib/decision-gate/override-policies';

export async function GET(): Promise<Response> {
  try {
    const policies = getPolicies();
    return NextResponse.json({ policies });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(): Promise<Response> {
  try {
    deleteAllPolicies();
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
