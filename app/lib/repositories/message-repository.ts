/**
 * Message Repository
 *
 * Optimized repository for message management.
 * Includes bulk operations, streaming, token tracking, and content search.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base-repository';
import { MessageRow } from '../types/database';
import { UUID } from '../types/domain';
import { Result, PaginatedResult, PaginationParams, SortOrder } from './types';
import { DatabaseError, ValidationError } from './errors';

/**
 * Message domain entity
 */
export interface Message {
  id: UUID;
  conversationId: UUID;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  createdAt: Date;
}

/**
 * Message with attachments
 */
export interface MessageWithAttachments extends Message {
  attachmentCount: number;
}

/**
 * Message creation data
 */
export interface CreateMessageData {
  conversationId: UUID;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
}

/**
 * Message search parameters
 */
export interface MessageSearchParams {
  conversationId?: UUID;
  role?: 'user' | 'assistant';
  query?: string;
  hasModel?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  minTokens?: number;
  maxTokens?: number;
}

/**
 * Message list parameters
 */
export interface MessageListParams extends PaginationParams {
  conversationId: UUID;
  role?: 'user' | 'assistant';
  orderBy?: 'created_at';
  order?: SortOrder;
}

/**
 * Token statistics for a conversation
 */
export interface TokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  averageTokensPerMessage: number;
}

/**
 * Message streaming chunk
 */
export interface MessageChunk {
  messages: Message[];
  hasMore: boolean;
  nextOffset: number;
}

/**
 * Message repository with optimization features
 */
export class MessageRepository extends BaseRepository<Message> {
  protected get tableName(): string {
    return 'messages';
  }

  protected rowToEntity(row: unknown): Message {
    const r = row as MessageRow;
    return {
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      cost: r.cost,
      createdAt: new Date(r.created_at * 1000),
    };
  }

  protected entityToRow(entity: Partial<Message>): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.id !== undefined) row.id = entity.id;
    if (entity.conversationId !== undefined)
      row.conversation_id = entity.conversationId;
    if (entity.role !== undefined) row.role = entity.role;
    if (entity.content !== undefined) row.content = entity.content;
    if (entity.model !== undefined) row.model = entity.model;
    if (entity.inputTokens !== undefined) row.input_tokens = entity.inputTokens;
    if (entity.outputTokens !== undefined)
      row.output_tokens = entity.outputTokens;
    if (entity.cost !== undefined) row.cost = entity.cost;
    if (entity.createdAt !== undefined)
      row.created_at = Math.floor(entity.createdAt.getTime() / 1000);

    return row;
  }

  /**
   * Create new message
   */
  createMessage(data: CreateMessageData): Result<Message> {
    const message: Partial<Message> = {
      id: uuidv4(),
      conversationId: data.conversationId,
      role: data.role,
      content: data.content.trim(),
      model: data.model || null,
      inputTokens: data.inputTokens || null,
      outputTokens: data.outputTokens || null,
      cost: data.cost || null,
      createdAt: new Date(),
    };

    // Validate
    const validation = this.validateMessage(message);
    if (!validation.ok) return validation;

    return this.create(message);
  }

  /**
   * Create multiple messages in bulk (optimized)
   */
  createBulk(messages: CreateMessageData[]): Result<Message[]> {
    if (messages.length === 0) {
      return { ok: true, value: [] };
    }

    return this.transaction(() => {
      const created: Message[] = [];

      // Use prepared statement for efficiency
      const stmt = this.db.prepare(
        `INSERT INTO messages 
         (id, conversation_id, role, content, model, input_tokens, output_tokens, cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const data of messages) {
        const message: Partial<Message> = {
          id: uuidv4(),
          conversationId: data.conversationId,
          role: data.role,
          content: data.content.trim(),
          model: data.model || null,
          inputTokens: data.inputTokens || null,
          outputTokens: data.outputTokens || null,
          cost: data.cost || null,
          createdAt: new Date(),
        };

        // Validate
        const validation = this.validateMessage(message);
        if (!validation.ok) {
          throw validation.error;
        }

        const row = this.entityToRow(message);
        stmt.run(
          row.id,
          row.conversation_id,
          row.role,
          row.content,
          row.model,
          row.input_tokens,
          row.output_tokens,
          row.cost,
          row.created_at
        );

        created.push(message as Message);
      }

      return created;
    });
  }

  /**
   * Get messages for a conversation
   */
  findByConversation(
    conversationId: UUID,
    params?: { limit?: number; offset?: number; order?: SortOrder }
  ): Result<Message[]> {
    try {
      const limit = params?.limit || 100;
      const offset = params?.offset || 0;
      const order = params?.order || 'asc';

      const rows = this.db
        .prepare(
          `
          SELECT * FROM messages 
          WHERE conversation_id = ?
          ORDER BY created_at ${order.toUpperCase()}
          LIMIT ? OFFSET ?
        `
        )
        .all(conversationId, limit, offset) as MessageRow[];

      const messages = rows.map((row) => this.rowToEntity(row));
      return { ok: true, value: messages };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to find messages by conversation',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get messages with pagination
   */
  listMessages(params: MessageListParams): Result<PaginatedResult<Message>> {
    try {
      const {
        conversationId,
        role,
        orderBy = 'created_at',
        order = 'asc',
        page,
        pageSize,
      } = params;

      const offset = (page - 1) * pageSize;

      // Build WHERE clause
      const conditions: string[] = ['conversation_id = ?'];
      const values: unknown[] = [conversationId];

      if (role !== undefined) {
        conditions.push('role = ?');
        values.push(role);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = this.db
        .prepare(`SELECT COUNT(*) as count FROM messages ${whereClause}`)
        .get(...values) as { count: number };

      const total = countResult.count;
      const totalPages = Math.ceil(total / pageSize);

      // Get page data
      const rows = this.db
        .prepare(
          `
          SELECT * FROM messages 
          ${whereClause}
          ORDER BY ${orderBy} ${order.toUpperCase()}
          LIMIT ? OFFSET ?
        `
        )
        .all(...values, pageSize, offset) as MessageRow[];

      const items = rows.map((row) => this.rowToEntity(row));

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
          'Failed to list messages',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Stream messages in chunks (for large conversations)
   */
  streamMessages(
    conversationId: UUID,
    chunkSize: number = 50
  ): Result<Generator<MessageChunk>> {
    try {
      const totalResult = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`
        )
        .get(conversationId) as { count: number };

      const total = totalResult.count;

      function* messageStream(
        this: MessageRepository
      ): Generator<MessageChunk> {
        let offset = 0;

        while (offset < total) {
          const rows = this.db
            .prepare(
              `
              SELECT * FROM messages 
              WHERE conversation_id = ?
              ORDER BY created_at ASC
              LIMIT ? OFFSET ?
            `
            )
            .all(conversationId, chunkSize, offset) as MessageRow[];

          const messages = rows.map((row) => this.rowToEntity(row));
          offset += chunkSize;

          yield {
            messages,
            hasMore: offset < total,
            nextOffset: offset,
          };
        }
      }

      return { ok: true, value: messageStream.call(this) };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to stream messages',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Search messages by content
   */
  searchMessages(
    params: MessageSearchParams & PaginationParams
  ): Result<PaginatedResult<Message>> {
    try {
      const {
        conversationId,
        role,
        query,
        hasModel,
        dateFrom,
        dateTo,
        minTokens,
        maxTokens,
        page,
        pageSize,
      } = params;

      const offset = (page - 1) * pageSize;

      // Build WHERE clause
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (conversationId !== undefined) {
        conditions.push('conversation_id = ?');
        values.push(conversationId);
      }

      if (role !== undefined) {
        conditions.push('role = ?');
        values.push(role);
      }

      // FTS search
      if (query && query.trim()) {
        conditions.push(
          `id IN (SELECT id FROM messages_fts WHERE content MATCH ?)`
        );
        values.push(query.trim());
      }

      if (hasModel !== undefined) {
        if (hasModel) {
          conditions.push('model IS NOT NULL');
        } else {
          conditions.push('model IS NULL');
        }
      }

      if (dateFrom) {
        conditions.push('created_at >= ?');
        values.push(Math.floor(dateFrom.getTime() / 1000));
      }

      if (dateTo) {
        conditions.push('created_at <= ?');
        values.push(Math.floor(dateTo.getTime() / 1000));
      }

      if (minTokens !== undefined) {
        conditions.push(
          '(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) >= ?'
        );
        values.push(minTokens);
      }

      if (maxTokens !== undefined) {
        conditions.push(
          '(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) <= ?'
        );
        values.push(maxTokens);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = this.db
        .prepare(`SELECT COUNT(*) as count FROM messages ${whereClause}`)
        .get(...values) as { count: number };

      const total = countResult.count;
      const totalPages = Math.ceil(total / pageSize);

      // Get page data
      const rows = this.db
        .prepare(
          `
          SELECT * FROM messages 
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `
        )
        .all(...values, pageSize, offset) as MessageRow[];

      const items = rows.map((row) => this.rowToEntity(row));

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
          'Failed to search messages',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get token statistics for a conversation
   */
  getTokenStats(conversationId: UUID): Result<TokenStats> {
    try {
      const stats = this.db
        .prepare(
          `
          SELECT 
            COALESCE(SUM(input_tokens), 0) as total_input,
            COALESCE(SUM(output_tokens), 0) as total_output,
            COALESCE(SUM(cost), 0) as total_cost,
            COUNT(*) as count
          FROM messages
          WHERE conversation_id = ?
        `
        )
        .get(conversationId) as {
        total_input: number;
        total_output: number;
        total_cost: number;
        count: number;
      };

      const totalTokens = stats.total_input + stats.total_output;
      const averageTokensPerMessage =
        stats.count > 0 ? totalTokens / stats.count : 0;

      return {
        ok: true,
        value: {
          totalInputTokens: stats.total_input,
          totalOutputTokens: stats.total_output,
          totalTokens,
          totalCost: stats.total_cost,
          messageCount: stats.count,
          averageTokensPerMessage,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to get token statistics',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get latest message in conversation
   */
  getLatest(conversationId: UUID): Result<Message | null> {
    try {
      const row = this.db
        .prepare(
          `
          SELECT * FROM messages 
          WHERE conversation_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `
        )
        .get(conversationId) as MessageRow | undefined;

      if (!row) {
        return { ok: true, value: null };
      }

      return { ok: true, value: this.rowToEntity(row) };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to get latest message',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get message count for conversation
   */
  countByConversation(conversationId: UUID): Result<number> {
    try {
      const result = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`
        )
        .get(conversationId) as { count: number };

      return { ok: true, value: result.count };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to count messages',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Delete all messages for a conversation
   */
  deleteByConversation(conversationId: UUID): Result<number> {
    try {
      const result = this.db
        .prepare(`DELETE FROM messages WHERE conversation_id = ?`)
        .run(conversationId);

      return { ok: true, value: result.changes };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to delete messages by conversation',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Update message token counts and cost
   */
  updateTokens(
    id: UUID,
    data: {
      inputTokens?: number;
      outputTokens?: number;
      cost?: number;
      model?: string;
    }
  ): Result<Message> {
    const updates: Partial<Message> = {};

    if (data.inputTokens !== undefined) updates.inputTokens = data.inputTokens;
    if (data.outputTokens !== undefined)
      updates.outputTokens = data.outputTokens;
    if (data.cost !== undefined) updates.cost = data.cost;
    if (data.model !== undefined) updates.model = data.model;

    return this.update(id, updates);
  }

  /**
   * Get assistant messages only
   */
  getAssistantMessages(conversationId: UUID): Result<Message[]> {
    try {
      const rows = this.db
        .prepare(
          `
          SELECT * FROM messages 
          WHERE conversation_id = ? AND role = 'assistant'
          ORDER BY created_at ASC
        `
        )
        .all(conversationId) as MessageRow[];

      const messages = rows.map((row) => this.rowToEntity(row));
      return { ok: true, value: messages };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to get assistant messages',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get user messages only
   */
  getUserMessages(conversationId: UUID): Result<Message[]> {
    try {
      const rows = this.db
        .prepare(
          `
          SELECT * FROM messages 
          WHERE conversation_id = ? AND role = 'user'
          ORDER BY created_at ASC
        `
        )
        .all(conversationId) as MessageRow[];

      const messages = rows.map((row) => this.rowToEntity(row));
      return { ok: true, value: messages };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to get user messages',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Export conversation messages
   */
  exportConversation(conversationId: UUID): Result<{
    messages: Message[];
    stats: TokenStats;
  }> {
    return this.transaction(() => {
      const messagesResult = this.findByConversation(conversationId);
      if (!messagesResult.ok) throw messagesResult.error;

      const statsResult = this.getTokenStats(conversationId);
      if (!statsResult.ok) throw statsResult.error;

      return {
        messages: messagesResult.value,
        stats: statsResult.value,
      };
    });
  }

  /**
   * Validate message data
   */
  private validateMessage(message: Partial<Message>): Result<void> {
    if (!message.conversationId) {
      return {
        ok: false,
        error: new ValidationError(
          'Conversation ID is required',
          'conversationId'
        ),
      };
    }

    if (!message.role) {
      return {
        ok: false,
        error: new ValidationError('Role is required', 'role'),
      };
    }

    if (!['user', 'assistant'].includes(message.role)) {
      return {
        ok: false,
        error: new ValidationError('Role must be user or assistant', 'role'),
      };
    }

    if (!message.content || !message.content.trim()) {
      return {
        ok: false,
        error: new ValidationError('Content is required', 'content'),
      };
    }

    // Validate token consistency
    if (
      (message.inputTokens !== null || message.outputTokens !== null) &&
      !message.model
    ) {
      return {
        ok: false,
        error: new ValidationError(
          'Model is required when tokens are specified',
          'model'
        ),
      };
    }

    if (
      message.cost !== null &&
      !message.inputTokens &&
      !message.outputTokens
    ) {
      return {
        ok: false,
        error: new ValidationError(
          'Token counts are required when cost is specified',
          'cost'
        ),
      };
    }

    return { ok: true, value: undefined };
  }
}
