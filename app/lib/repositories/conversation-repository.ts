/**
 * Conversation Repository
 *
 * Full-featured repository for conversation management.
 * Includes search, filtering, archiving, pinning, and statistics.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base-repository';
import { ConversationRow } from '../types/database';
import { UUID } from '../types/domain';
import { Result, PaginatedResult, PaginationParams, SortOrder } from './types';
import { DatabaseError, ValidationError, NotFoundError } from './errors';

/**
 * Conversation domain entity
 */
export interface Conversation {
  id: UUID;
  title: string;
  model: string;
  modelTier: 'haiku' | 'sonnet' | 'opus';
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  pinned: boolean;
  totalTokens: number;
  totalCost: number;
}

/**
 * Conversation with statistics
 */
export interface ConversationWithStats extends Conversation {
  messageCount: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
}

/**
 * Conversation search parameters
 */
export interface ConversationSearchParams {
  query?: string;
  modelTier?: 'haiku' | 'sonnet' | 'opus';
  archived?: boolean;
  pinned?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  minCost?: number;
  maxCost?: number;
}

/**
 * Conversation list filters
 */
export interface ConversationListParams extends PaginationParams {
  archived?: boolean;
  pinned?: boolean;
  orderBy?: 'created_at' | 'updated_at' | 'title' | 'total_cost';
  order?: SortOrder;
}

/**
 * Conversation statistics
 */
export interface ConversationStats {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  averageMessagesPerConversation: number;
  averageTokensPerMessage: number;
  conversationsByModelTier: Record<string, number>;
  archivedCount: number;
  pinnedCount: number;
}

/**
 * Conversation repository with full features
 */
export class ConversationRepository extends BaseRepository<Conversation> {
  protected get tableName(): string {
    return 'conversations';
  }

  protected rowToEntity(row: unknown): Conversation {
    const r = row as ConversationRow;
    return {
      id: r.id,
      title: r.title,
      model: r.model,
      modelTier: r.model_tier as 'haiku' | 'sonnet' | 'opus',
      createdAt: new Date(r.created_at * 1000),
      updatedAt: new Date(r.updated_at * 1000),
      archived: r.archived === 1,
      pinned: r.pinned === 1,
      totalTokens: r.total_tokens,
      totalCost: r.total_cost,
    };
  }

  protected entityToRow(
    entity: Partial<Conversation>
  ): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.id !== undefined) row.id = entity.id;
    if (entity.title !== undefined) row.title = entity.title;
    if (entity.model !== undefined) row.model = entity.model;
    if (entity.modelTier !== undefined) row.model_tier = entity.modelTier;
    if (entity.createdAt !== undefined)
      row.created_at = Math.floor(entity.createdAt.getTime() / 1000);
    if (entity.updatedAt !== undefined)
      row.updated_at = Math.floor(entity.updatedAt.getTime() / 1000);
    if (entity.archived !== undefined) row.archived = entity.archived ? 1 : 0;
    if (entity.pinned !== undefined) row.pinned = entity.pinned ? 1 : 0;
    if (entity.totalTokens !== undefined) row.total_tokens = entity.totalTokens;
    if (entity.totalCost !== undefined) row.total_cost = entity.totalCost;

    return row;
  }

  /**
   * Create new conversation
   */
  createConversation(data: {
    title: string;
    model: string;
    modelTier: 'haiku' | 'sonnet' | 'opus';
  }): Result<Conversation> {
    const conversation: Partial<Conversation> = {
      id: uuidv4(),
      title: data.title.trim(),
      model: data.model,
      modelTier: data.modelTier,
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      pinned: false,
      totalTokens: 0,
      totalCost: 0,
    };

    // Validate
    const validation = this.validateConversation(conversation);
    if (!validation.ok) return validation;

    return this.create(conversation);
  }

  /**
   * Get conversation with statistics
   */
  findByIdWithStats(id: UUID): Result<ConversationWithStats> {
    try {
      const row = this.db
        .prepare(
          `
          SELECT * FROM conversations_with_stats 
          WHERE id = ?
        `
        )
        .get(id) as ConversationRow & {
        message_count: number;
        last_message_at: number | null;
        last_message_preview: string | null;
      };

      if (!row) {
        return {
          ok: false,
          error: new NotFoundError(this.tableName, id),
        };
      }

      const conversation = this.rowToEntity(row);
      return {
        ok: true,
        value: {
          ...conversation,
          messageCount: row.message_count,
          lastMessageAt: row.last_message_at
            ? new Date(row.last_message_at * 1000)
            : null,
          lastMessagePreview: row.last_message_preview,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to find conversation with stats',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * List conversations with filtering and pagination
   */
  listConversations(
    params: ConversationListParams
  ): Result<PaginatedResult<ConversationWithStats>> {
    try {
      const {
        page,
        pageSize,
        archived,
        pinned,
        orderBy = 'updated_at',
        order = 'desc',
      } = params;

      const offset = (page - 1) * pageSize;

      // Build WHERE clause
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (archived !== undefined) {
        conditions.push('archived = ?');
        values.push(archived ? 1 : 0);
      }

      if (pinned !== undefined) {
        conditions.push('pinned = ?');
        values.push(pinned ? 1 : 0);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM conversations_with_stats ${whereClause}`
        )
        .get(...values) as { count: number };

      const total = countResult.count;
      const totalPages = Math.ceil(total / pageSize);

      // Get page data
      const rows = this.db
        .prepare(
          `
          SELECT * FROM conversations_with_stats 
          ${whereClause}
          ORDER BY ${orderBy} ${order.toUpperCase()}
          LIMIT ? OFFSET ?
        `
        )
        .all(...values, pageSize, offset) as (ConversationRow & {
        message_count: number;
        last_message_at: number | null;
        last_message_preview: string | null;
      })[];

      const items = rows.map((row) => {
        const conversation = this.rowToEntity(row);
        return {
          ...conversation,
          messageCount: row.message_count,
          lastMessageAt: row.last_message_at
            ? new Date(row.last_message_at * 1000)
            : null,
          lastMessagePreview: row.last_message_preview,
        };
      });

      return {
        ok: true,
        value: {
          items,
          total,
          page,
          pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to list conversations',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Search conversations by title or content
   */
  searchConversations(
    params: ConversationSearchParams & PaginationParams
  ): Result<PaginatedResult<ConversationWithStats>> {
    try {
      const {
        query,
        modelTier,
        archived,
        pinned,
        dateFrom,
        dateTo,
        minCost,
        maxCost,
        page,
        pageSize,
      } = params;

      const offset = (page - 1) * pageSize;

      // Build WHERE clause
      const conditions: string[] = [];
      const values: unknown[] = [];

      // FTS search
      if (query && query.trim()) {
        conditions.push(
          `id IN (SELECT id FROM conversations_fts WHERE title MATCH ?)`
        );
        values.push(query.trim());
      }

      if (modelTier !== undefined) {
        conditions.push('model_tier = ?');
        values.push(modelTier);
      }

      if (archived !== undefined) {
        conditions.push('archived = ?');
        values.push(archived ? 1 : 0);
      }

      if (pinned !== undefined) {
        conditions.push('pinned = ?');
        values.push(pinned ? 1 : 0);
      }

      if (dateFrom) {
        conditions.push('created_at >= ?');
        values.push(Math.floor(dateFrom.getTime() / 1000));
      }

      if (dateTo) {
        conditions.push('created_at <= ?');
        values.push(Math.floor(dateTo.getTime() / 1000));
      }

      if (minCost !== undefined) {
        conditions.push('total_cost >= ?');
        values.push(minCost);
      }

      if (maxCost !== undefined) {
        conditions.push('total_cost <= ?');
        values.push(maxCost);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM conversations_with_stats ${whereClause}`
        )
        .get(...values) as { count: number };

      const total = countResult.count;
      const totalPages = Math.ceil(total / pageSize);

      // Get page data
      const rows = this.db
        .prepare(
          `
          SELECT * FROM conversations_with_stats 
          ${whereClause}
          ORDER BY updated_at DESC
          LIMIT ? OFFSET ?
        `
        )
        .all(...values, pageSize, offset) as (ConversationRow & {
        message_count: number;
        last_message_at: number | null;
        last_message_preview: string | null;
      })[];

      const items = rows.map((row) => {
        const conversation = this.rowToEntity(row);
        return {
          ...conversation,
          messageCount: row.message_count,
          lastMessageAt: row.last_message_at
            ? new Date(row.last_message_at * 1000)
            : null,
          lastMessagePreview: row.last_message_preview,
        };
      });

      return {
        ok: true,
        value: {
          items,
          total,
          page,
          pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to search conversations',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Archive conversation
   */
  archive(id: UUID): Result<Conversation> {
    return this.update(id, { archived: true });
  }

  /**
   * Unarchive conversation
   */
  unarchive(id: UUID): Result<Conversation> {
    return this.update(id, { archived: false });
  }

  /**
   * Pin conversation
   */
  pin(id: UUID): Result<Conversation> {
    return this.update(id, { pinned: true });
  }

  /**
   * Unpin conversation
   */
  unpin(id: UUID): Result<Conversation> {
    return this.update(id, { pinned: false });
  }

  /**
   * Update conversation title
   */
  updateTitle(id: UUID, title: string): Result<Conversation> {
    const trimmed = title.trim();
    if (!trimmed) {
      return {
        ok: false,
        error: new ValidationError('Title cannot be empty', 'title'),
      };
    }

    return this.update(id, { title: trimmed });
  }

  /**
   * Get conversation statistics
   */
  getStatistics(): Result<ConversationStats> {
    try {
      const stats = this.db
        .prepare(
          `
          SELECT 
            COUNT(*) as total_conversations,
            COALESCE(SUM(message_count), 0) as total_messages,
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(total_cost), 0) as total_cost,
            COALESCE(AVG(message_count), 0) as avg_messages,
            COALESCE(SUM(archived), 0) as archived_count,
            COALESCE(SUM(pinned), 0) as pinned_count
          FROM conversations_with_stats
        `
        )
        .get() as {
        total_conversations: number;
        total_messages: number;
        total_tokens: number;
        total_cost: number;
        avg_messages: number;
        archived_count: number;
        pinned_count: number;
      };

      const byTier = this.db
        .prepare(
          `
          SELECT model_tier, COUNT(*) as count
          FROM conversations
          GROUP BY model_tier
        `
        )
        .all() as { model_tier: string; count: number }[];

      const conversationsByModelTier: Record<string, number> = {};
      byTier.forEach((row) => {
        conversationsByModelTier[row.model_tier] = row.count;
      });

      const averageTokensPerMessage =
        stats.total_messages > 0
          ? stats.total_tokens / stats.total_messages
          : 0;

      return {
        ok: true,
        value: {
          totalConversations: stats.total_conversations,
          totalMessages: stats.total_messages,
          totalTokens: stats.total_tokens,
          totalCost: stats.total_cost,
          averageMessagesPerConversation: stats.avg_messages,
          averageTokensPerMessage,
          conversationsByModelTier,
          archivedCount: stats.archived_count,
          pinnedCount: stats.pinned_count,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to get conversation statistics',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get recent conversations
   */
  getRecent(limit: number = 10): Result<ConversationWithStats[]> {
    try {
      const rows = this.db
        .prepare(
          `
          SELECT * FROM conversations_with_stats 
          WHERE archived = 0
          ORDER BY updated_at DESC
          LIMIT ?
        `
        )
        .all(limit) as (ConversationRow & {
        message_count: number;
        last_message_at: number | null;
        last_message_preview: string | null;
      })[];

      const conversations = rows.map((row) => {
        const conversation = this.rowToEntity(row);
        return {
          ...conversation,
          messageCount: row.message_count,
          lastMessageAt: row.last_message_at
            ? new Date(row.last_message_at * 1000)
            : null,
          lastMessagePreview: row.last_message_preview,
        };
      });

      return { ok: true, value: conversations };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to get recent conversations',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get pinned conversations
   */
  getPinned(): Result<ConversationWithStats[]> {
    try {
      const rows = this.db
        .prepare(
          `
          SELECT * FROM conversations_with_stats 
          WHERE pinned = 1
          ORDER BY updated_at DESC
        `
        )
        .all() as (ConversationRow & {
        message_count: number;
        last_message_at: number | null;
        last_message_preview: string | null;
      })[];

      const conversations = rows.map((row) => {
        const conversation = this.rowToEntity(row);
        return {
          ...conversation,
          messageCount: row.message_count,
          lastMessageAt: row.last_message_at
            ? new Date(row.last_message_at * 1000)
            : null,
          lastMessagePreview: row.last_message_preview,
        };
      });

      return { ok: true, value: conversations };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to get pinned conversations',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Validate conversation data
   */
  private validateConversation(
    conversation: Partial<Conversation>
  ): Result<void> {
    if (!conversation.title || !conversation.title.trim()) {
      return {
        ok: false,
        error: new ValidationError('Title is required', 'title'),
      };
    }

    if (!conversation.model || !conversation.model.trim()) {
      return {
        ok: false,
        error: new ValidationError('Model is required', 'model'),
      };
    }

    if (!conversation.modelTier) {
      return {
        ok: false,
        error: new ValidationError('Model tier is required', 'modelTier'),
      };
    }

    if (!['haiku', 'sonnet', 'opus'].includes(conversation.modelTier)) {
      return {
        ok: false,
        error: new ValidationError(
          'Model tier must be haiku, sonnet, or opus',
          'modelTier'
        ),
      };
    }

    return { ok: true, value: undefined };
  }
}
