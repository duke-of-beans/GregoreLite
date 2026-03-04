/**
 * KERNL Threads API Route — Sprint 10.8 Task 4
 *
 * GET /api/threads — List recent KERNL threads (used by RecentChats)
 */

import { listThreads } from '@/lib/kernl';
import { successResponse } from '@/lib/api/utils';

export const GET = async () => {
  try {
    const threads = listThreads(10);
    return successResponse({
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title || 'Untitled',
        updatedAt: new Date(t.updated_at).toISOString(),
      })),
    });
  } catch (err) {
    console.warn('[api/threads] KERNL unavailable:', err);
    return successResponse({ threads: [] });
  }
};
