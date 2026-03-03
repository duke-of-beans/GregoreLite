/**
 * auto-title — Sprint 10.5 Task 5
 *
 * Client-side function that fires a background call to /api/auto-title,
 * which in turn calls Anthropic Haiku to generate a 3-6 word title from
 * the first user message of a new conversation.
 *
 * Always resolves — returns "Untitled" on any network/API error.
 * Intended to be called fire-and-forget (no await at call site).
 */

interface AutoTitleResponse {
  data?: { title?: string };
  title?: string;
}

/**
 * Generate a 3-6 word title for a conversation from its first user message.
 * Never throws — returns "Untitled" on any failure.
 */
export async function generateTitle(firstUserMessage: string): Promise<string> {
  try {
    const res = await fetch('/api/auto-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: firstUserMessage }),
    });

    if (!res.ok) return 'Untitled';

    const body = (await res.json()) as AutoTitleResponse;
    // successResponse wraps in { data: { title } }
    const title = body.data?.title ?? body.title ?? '';
    return title.trim() || 'Untitled';
  } catch {
    return 'Untitled';
  }
}
