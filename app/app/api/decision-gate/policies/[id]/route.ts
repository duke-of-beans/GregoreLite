/**
 * DELETE /api/decision-gate/policies/[id] — remove a single override policy
 */

import type { NextRequest } from 'next/server';
import { deletePolicy } from '@/lib/decision-gate/override-policies';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const { id } = params;

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Missing policy id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    deletePolicy(id);
    return new Response(
      JSON.stringify({ deleted: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
