/**
 * Conversation API Client
 *
 * Client-side fetch wrapper for conversation operations.
 * Replaces direct repository imports to keep server-only code
 * out of the browser bundle.
 *
 * @module lib/api/conversation-client
 */

import type {
  APIResponse,
  ConversationListItem,
  ConversationDetail,
} from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConversationWithStats {
  id: string;
  title: string;
  model: string;
  modelTier: 'haiku' | 'sonnet' | 'opus';
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  pinned: boolean;
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function listItemToConversationWithStats(
  item: ConversationListItem
): ConversationWithStats {
  return {
    id: item.id,
    title: item.title,
    model: item.model,
    modelTier: 'sonnet', // API doesn't expose tier in list; default
    createdAt: new Date(item.lastMessageAt),
    updatedAt: new Date(item.lastMessageAt),
    archived: item.archived,
    pinned: item.pinned,
    totalTokens: 0,
    totalCost: 0,
    messageCount: item.messageCount,
    lastMessageAt: item.lastMessageAt ? new Date(item.lastMessageAt) : null,
    lastMessagePreview: item.preview || null,
  };
}

function detailToConversationWithStats(
  detail: ConversationDetail
): ConversationWithStats {
  return {
    id: detail.id,
    title: detail.title,
    model: detail.model,
    modelTier: 'sonnet',
    createdAt: new Date(detail.createdAt),
    updatedAt: new Date(detail.updatedAt),
    archived: detail.archived,
    pinned: detail.pinned,
    totalTokens: detail.totalTokens,
    totalCost: detail.totalCost,
    messageCount: detail.messageCount,
    lastMessageAt: detail.lastMessageAt ? new Date(detail.lastMessageAt) : null,
    lastMessagePreview: detail.preview || null,
  };
}

async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as APIResponse).error || `API error: ${res.status}`
    );
  }

  const json = (await res.json()) as APIResponse<T>;
  if (!json.success) {
    throw new Error(json.error || 'Unknown API error');
  }

  return json.data as T;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new conversation
 */
export async function createConversation(data: {
  title: string;
  model: string;
  modelTier: 'haiku' | 'sonnet' | 'opus';
}): Promise<ConversationWithStats> {
  const result = await apiRequest<{ id: string; title: string }>(
    '/api/conversations',
    {
      method: 'POST',
      body: JSON.stringify({ title: data.title }),
    }
  );

  // Return a minimal ConversationWithStats — caller can reload for full stats
  return {
    id: result.id,
    title: result.title,
    model: data.model,
    modelTier: data.modelTier,
    createdAt: new Date(),
    updatedAt: new Date(),
    archived: false,
    pinned: false,
    totalTokens: 0,
    totalCost: 0,
    messageCount: 0,
    lastMessageAt: null,
    lastMessagePreview: null,
  };
}

/**
 * Get conversation by ID with stats
 */
export async function getConversation(
  id: string
): Promise<ConversationWithStats> {
  const detail = await apiRequest<ConversationDetail>(
    `/api/conversations/${id}`
  );
  return detailToConversationWithStats(detail);
}

/**
 * Update conversation title
 */
export async function updateTitle(
  id: string,
  title: string
): Promise<void> {
  await apiRequest(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

/**
 * Archive conversation
 */
export async function archiveConversation(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  });
}

/**
 * Unarchive conversation
 */
export async function unarchiveConversation(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: false }),
  });
}

/**
 * Pin conversation
 */
export async function pinConversation(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ pinned: true }),
  });
}

/**
 * Unpin conversation
 */
export async function unpinConversation(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ pinned: false }),
  });
}

/**
 * Delete conversation
 */
export async function deleteConversation(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}`, {
    method: 'DELETE',
  });
}

/**
 * List conversations with pagination and filters
 */
export async function listConversations(params: {
  page?: number;
  pageSize?: number;
  archived?: boolean;
  pinned?: boolean | null;
}): Promise<PaginatedResult<ConversationWithStats>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params.archived !== undefined)
    searchParams.set('archived', String(params.archived));
  if (params.pinned !== undefined && params.pinned !== null)
    searchParams.set('pinned', String(params.pinned));

  const qs = searchParams.toString();
  const url = `/api/conversations${qs ? `?${qs}` : ''}`;

  const result = await apiRequest<{
    conversations: ConversationListItem[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }>(url);

  return {
    items: result.conversations.map(listItemToConversationWithStats),
    total: result.pagination.totalItems,
    page: result.pagination.page,
    pageSize: result.pagination.pageSize,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrevious,
  };
}

/**
 * Search conversations
 */
export async function searchConversations(params: {
  query: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<ConversationWithStats>> {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('q', params.query);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));

  const qs = searchParams.toString();
  const url = `/api/conversations?${qs}`;

  const result = await apiRequest<{
    conversations: ConversationListItem[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }>(url);

  return {
    items: result.conversations.map(listItemToConversationWithStats),
    total: result.pagination.totalItems,
    page: result.pagination.page,
    pageSize: result.pagination.pageSize,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrevious,
  };
}

/**
 * Record feedback for a suggestion (fire-and-forget)
 */
export function recordSuggestionFeedback(
  suggestionId: string,
  action: 'accepted' | 'dismissed' | 'ignored'
): void {
  fetch('/api/cross-context/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suggestionId, action }),
  }).catch(() => {
    // non-blocking — feedback recording is best-effort
  });
}
