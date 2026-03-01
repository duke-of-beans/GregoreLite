/**
 * KERNL Artifact Sync — Sprint 2D
 *
 * Writes a detected artifact record to the KERNL artifacts table via the
 * /api/kernl/artifact POST endpoint.
 *
 * Non-blocking: failure is logged but never throws to the caller.
 * This keeps the chat flow uninterrupted even if KERNL write fails.
 */

import type { Artifact } from './types';

export async function syncArtifact(
  artifact: Artifact,
  threadId: string,
): Promise<void> {
  try {
    const res = await fetch('/api/kernl/artifact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: artifact.id,
        threadId,
        type: artifact.type,
        language: artifact.language,
        content: artifact.content,
      }),
    });

    if (!res.ok) {
      console.warn('[kernl-sync] artifact write returned', res.status);
    }
  } catch (err) {
    // KERNL write failure is non-fatal — artifact still renders in panel
    console.warn('[kernl-sync] artifact write failed:', err);
  }
}
