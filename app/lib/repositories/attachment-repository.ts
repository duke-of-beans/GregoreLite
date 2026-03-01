/**
 * Attachment Repository
 *
 * Repository for file attachment management.
 * Handles base64 storage, validation, and efficient retrieval.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base-repository';
import { AttachmentRow } from '../types/database';
import { UUID } from '../types/domain';
import { Result } from './types';
import { DatabaseError, ValidationError } from './errors';

/**
 * Attachment domain entity
 */
export interface Attachment {
  id: UUID;
  messageId: UUID;
  type: 'image' | 'document' | 'file';
  name: string;
  size: number;
  mimeType: string;
  base64Data: string;
  createdAt: Date;
}

/**
 * Attachment creation data
 */
export interface CreateAttachmentData {
  messageId: UUID;
  type: 'image' | 'document' | 'file';
  name: string;
  size: number;
  mimeType: string;
  base64Data: string;
}

/**
 * Attachment metadata (without base64 data for performance)
 */
export interface AttachmentMetadata {
  id: UUID;
  messageId: UUID;
  type: 'image' | 'document' | 'file';
  name: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

/**
 * Attachment statistics
 */
export interface AttachmentStats {
  totalAttachments: number;
  totalSize: number;
  averageSize: number;
  byType: Record<string, { count: number; totalSize: number }>;
  byMimeType: Record<string, number>;
}

/**
 * Size limits in bytes
 */
const SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  document: 50 * 1024 * 1024, // 50MB
  file: 100 * 1024 * 1024, // 100MB
};

/**
 * Attachment repository
 */
export class AttachmentRepository extends BaseRepository<Attachment> {
  protected get tableName(): string {
    return 'attachments';
  }

  protected rowToEntity(row: unknown): Attachment {
    const r = row as AttachmentRow;
    return {
      id: r.id,
      messageId: r.message_id,
      type: r.type as 'image' | 'document' | 'file',
      name: r.name,
      size: r.size,
      mimeType: r.mime_type,
      base64Data: r.base64_data,
      createdAt: new Date(r.created_at * 1000),
    };
  }

  protected entityToRow(entity: Partial<Attachment>): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.id !== undefined) row.id = entity.id;
    if (entity.messageId !== undefined) row.message_id = entity.messageId;
    if (entity.type !== undefined) row.type = entity.type;
    if (entity.name !== undefined) row.name = entity.name;
    if (entity.size !== undefined) row.size = entity.size;
    if (entity.mimeType !== undefined) row.mime_type = entity.mimeType;
    if (entity.base64Data !== undefined) row.base64_data = entity.base64Data;
    if (entity.createdAt !== undefined)
      row.created_at = Math.floor(entity.createdAt.getTime() / 1000);

    return row;
  }

  /**
   * Create new attachment
   */
  createAttachment(data: CreateAttachmentData): Result<Attachment> {
    const attachment: Partial<Attachment> = {
      id: uuidv4(),
      messageId: data.messageId,
      type: data.type,
      name: data.name.trim(),
      size: data.size,
      mimeType: data.mimeType.trim(),
      base64Data: data.base64Data,
      createdAt: new Date(),
    };

    // Validate
    const validation = this.validateAttachment(attachment);
    if (!validation.ok) return validation;

    return this.create(attachment);
  }

  /**
   * Get attachments for a message (with data)
   */
  findByMessage(messageId: UUID): Result<Attachment[]> {
    try {
      const rows = this.db
        .prepare(
          `
          SELECT * FROM attachments 
          WHERE message_id = ?
          ORDER BY created_at ASC
        `
        )
        .all(messageId) as AttachmentRow[];

      const attachments = rows.map((row) => this.rowToEntity(row));
      return { ok: true, value: attachments };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to find attachments by message',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get attachment metadata only (without base64 data for performance)
   */
  findMetadataByMessage(messageId: UUID): Result<AttachmentMetadata[]> {
    try {
      const rows = this.db
        .prepare(
          `
          SELECT id, message_id, type, name, size, mime_type, created_at 
          FROM attachments 
          WHERE message_id = ?
          ORDER BY created_at ASC
        `
        )
        .all(messageId) as Omit<AttachmentRow, 'base64_data'>[];

      const metadata = rows.map((row) => ({
        id: row.id,
        messageId: row.message_id,
        type: row.type as 'image' | 'document' | 'file',
        name: row.name,
        size: row.size,
        mimeType: row.mime_type,
        createdAt: new Date(row.created_at * 1000),
      }));

      return { ok: true, value: metadata };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to find attachment metadata',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get attachment data only (for lazy loading)
   */
  getAttachmentData(id: UUID): Result<string> {
    try {
      const result = this.db
        .prepare(`SELECT base64_data FROM attachments WHERE id = ?`)
        .get(id) as { base64_data: string } | undefined;

      if (!result) {
        return {
          ok: false,
          error: new DatabaseError(`Attachment ${id} not found`),
        };
      }

      return { ok: true, value: result.base64_data };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to get attachment data',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get attachments by type
   */
  findByType(
    type: 'image' | 'document' | 'file',
    limit?: number
  ): Result<AttachmentMetadata[]> {
    try {
      const query = limit
        ? `SELECT id, message_id, type, name, size, mime_type, created_at 
           FROM attachments 
           WHERE type = ? 
           ORDER BY created_at DESC 
           LIMIT ?`
        : `SELECT id, message_id, type, name, size, mime_type, created_at 
           FROM attachments 
           WHERE type = ? 
           ORDER BY created_at DESC`;

      const rows = limit
        ? (this.db.prepare(query).all(type, limit) as Omit<
            AttachmentRow,
            'base64_data'
          >[])
        : (this.db.prepare(query).all(type) as Omit<
            AttachmentRow,
            'base64_data'
          >[]);

      const metadata = rows.map((row) => ({
        id: row.id,
        messageId: row.message_id,
        type: row.type as 'image' | 'document' | 'file',
        name: row.name,
        size: row.size,
        mimeType: row.mime_type,
        createdAt: new Date(row.created_at * 1000),
      }));

      return { ok: true, value: metadata };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to find attachments by type',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get large attachments (over specified size)
   */
  findLargeAttachments(
    minSize: number = 1024 * 1024
  ): Result<AttachmentMetadata[]> {
    try {
      const rows = this.db
        .prepare(
          `
          SELECT id, message_id, type, name, size, mime_type, created_at 
          FROM attachments 
          WHERE size >= ?
          ORDER BY size DESC
        `
        )
        .all(minSize) as Omit<AttachmentRow, 'base64_data'>[];

      const metadata = rows.map((row) => ({
        id: row.id,
        messageId: row.message_id,
        type: row.type as 'image' | 'document' | 'file',
        name: row.name,
        size: row.size,
        mimeType: row.mime_type,
        createdAt: new Date(row.created_at * 1000),
      }));

      return { ok: true, value: metadata };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to find large attachments',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Get attachment statistics
   */
  getStatistics(): Result<AttachmentStats> {
    try {
      const totalStats = this.db
        .prepare(
          `
          SELECT 
            COUNT(*) as count,
            COALESCE(SUM(size), 0) as total_size,
            COALESCE(AVG(size), 0) as avg_size
          FROM attachments
        `
        )
        .get() as {
        count: number;
        total_size: number;
        avg_size: number;
      };

      const byType = this.db
        .prepare(
          `
          SELECT 
            type,
            COUNT(*) as count,
            SUM(size) as total_size
          FROM attachments
          GROUP BY type
        `
        )
        .all() as {
        type: string;
        count: number;
        total_size: number;
      }[];

      const byMimeType = this.db
        .prepare(
          `
          SELECT mime_type, COUNT(*) as count
          FROM attachments
          GROUP BY mime_type
        `
        )
        .all() as {
        mime_type: string;
        count: number;
      }[];

      const byTypeMap: Record<string, { count: number; totalSize: number }> =
        {};
      byType.forEach((row) => {
        byTypeMap[row.type] = {
          count: row.count,
          totalSize: row.total_size,
        };
      });

      const byMimeTypeMap: Record<string, number> = {};
      byMimeType.forEach((row) => {
        byMimeTypeMap[row.mime_type] = row.count;
      });

      return {
        ok: true,
        value: {
          totalAttachments: totalStats.count,
          totalSize: totalStats.total_size,
          averageSize: totalStats.avg_size,
          byType: byTypeMap,
          byMimeType: byMimeTypeMap,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to get attachment statistics',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Count attachments for a message
   */
  countByMessage(messageId: UUID): Result<number> {
    try {
      const result = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM attachments WHERE message_id = ?`
        )
        .get(messageId) as { count: number };

      return { ok: true, value: result.count };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to count attachments',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Delete all attachments for a message
   */
  deleteByMessage(messageId: UUID): Result<number> {
    try {
      const result = this.db
        .prepare(`DELETE FROM attachments WHERE message_id = ?`)
        .run(messageId);

      return { ok: true, value: result.changes };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to delete attachments by message',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Find orphaned attachments (messages deleted but attachments remain)
   */
  findOrphaned(): Result<UUID[]> {
    try {
      const rows = this.db
        .prepare(
          `
          SELECT a.id 
          FROM attachments a
          LEFT JOIN messages m ON a.message_id = m.id
          WHERE m.id IS NULL
        `
        )
        .all() as { id: string }[];

      return { ok: true, value: rows.map((r) => r.id) };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to find orphaned attachments',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Clean up orphaned attachments
   */
  cleanupOrphaned(): Result<number> {
    try {
      const result = this.db
        .prepare(
          `
          DELETE FROM attachments
          WHERE message_id NOT IN (SELECT id FROM messages)
        `
        )
        .run();

      return { ok: true, value: result.changes };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'Failed to cleanup orphaned attachments',
          error instanceof Error ? error : undefined
        ),
      };
    }
  }

  /**
   * Validate attachment data
   */
  private validateAttachment(attachment: Partial<Attachment>): Result<void> {
    if (!attachment.messageId) {
      return {
        ok: false,
        error: new ValidationError('Message ID is required', 'messageId'),
      };
    }

    if (!attachment.type) {
      return {
        ok: false,
        error: new ValidationError('Type is required', 'type'),
      };
    }

    if (!['image', 'document', 'file'].includes(attachment.type)) {
      return {
        ok: false,
        error: new ValidationError(
          'Type must be image, document, or file',
          'type'
        ),
      };
    }

    if (!attachment.name || !attachment.name.trim()) {
      return {
        ok: false,
        error: new ValidationError('Name is required', 'name'),
      };
    }

    if (!attachment.mimeType || !attachment.mimeType.trim()) {
      return {
        ok: false,
        error: new ValidationError('MIME type is required', 'mimeType'),
      };
    }

    if (!attachment.base64Data || !attachment.base64Data.trim()) {
      return {
        ok: false,
        error: new ValidationError('Base64 data is required', 'base64Data'),
      };
    }

    if (attachment.size === undefined || attachment.size <= 0) {
      return {
        ok: false,
        error: new ValidationError('Size must be greater than 0', 'size'),
      };
    }

    // Check size limits
    const limit = SIZE_LIMITS[attachment.type];
    if (attachment.size > limit) {
      return {
        ok: false,
        error: new ValidationError(
          `${attachment.type} size exceeds limit of ${limit} bytes`,
          'size'
        ),
      };
    }

    return { ok: true, value: undefined };
  }
}
