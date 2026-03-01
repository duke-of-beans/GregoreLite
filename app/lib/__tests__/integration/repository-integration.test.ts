/**
 * Repository Integration Tests
 *
 * Tests repository interactions with the database:
 * - CRUD operations using repository methods
 * - Transaction handling
 * - Cascading deletes
 * - Constraint enforcement
 * - Timestamp handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  ConversationRepository,
  MessageRepository,
  AttachmentRepository,
} from '@/lib/repositories';
import {
  setupTestDatabase,
  teardownTestDatabase,
  expectOk,
  expectErr,
  getTableCount,
  recordExists,
  expectRecentTimestamp,
} from '../utils/test-helpers';
// Fixtures available but not all used in these tests
// import { createTestConversation } from '../fixtures';

describe('Repository Integration Tests', () => {
  let db: Database.Database;
  let conversationRepo: ConversationRepository;
  let messageRepo: MessageRepository;
  let attachmentRepo: AttachmentRepository;

  beforeEach(async () => {
    db = await setupTestDatabase();
    conversationRepo = new ConversationRepository();
    messageRepo = new MessageRepository();
    attachmentRepo = new AttachmentRepository();
  });

  afterEach(() => {
    teardownTestDatabase();
  });

  // ==========================================================================
  // CONVERSATION CRUD
  // ==========================================================================

  describe('Conversation CRUD Operations', () => {
    it('should create a conversation', () => {
      const result = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });

      const created = expectOk(result);

      expect(created.title).toBe('Test Conversation');
      expect(created.model).toBe('claude-sonnet-4');
      expect(created.modelTier).toBe('sonnet');
      expect(getTableCount(db, 'conversations')).toBe(1);
    });

    it('should find conversation by ID', () => {
      const createResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const created = expectOk(createResult);

      const findResult = conversationRepo.findById(created.id);
      const found = expectOk(findResult);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should update conversation', () => {
      const createResult = conversationRepo.createConversation({
        title: 'Original Title',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const created = expectOk(createResult);

      const updateResult = conversationRepo.updateTitle(
        created.id,
        'Updated Title'
      );
      const updated = expectOk(updateResult);

      expect(updated.title).toBe('Updated Title');
    });

    it('should delete conversation', () => {
      const createResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const created = expectOk(createResult);

      const deleteResult = conversationRepo.delete(created.id);
      expect(deleteResult.ok).toBe(true);

      expect(getTableCount(db, 'conversations')).toBe(0);
      expect(recordExists(db, 'conversations', created.id)).toBe(false);
    });

    it('should list conversations with pagination', () => {
      // Create 5 conversations
      for (let i = 0; i < 5; i++) {
        conversationRepo.createConversation({
          title: `Test Conversation ${i + 1}`,
          model: 'claude-sonnet-4',
          modelTier: 'sonnet',
        });
      }

      const listResult = conversationRepo.listConversations({
        page: 1,
        pageSize: 10,
      });
      const paginated = expectOk(listResult);

      expect(paginated.items).toHaveLength(5);
      expect(paginated.total).toBe(5);
      expect(paginated.page).toBe(1);
    });

    it('should archive and unarchive conversation', () => {
      const createResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const created = expectOk(createResult);

      // Archive
      const archiveResult = conversationRepo.archive(created.id);
      const archived = expectOk(archiveResult);
      expect(archived.archived).toBe(true);

      // Unarchive
      const unarchiveResult = conversationRepo.unarchive(created.id);
      const unarchived = expectOk(unarchiveResult);
      expect(unarchived.archived).toBe(false);
    });

    it('should pin and unpin conversation', () => {
      const createResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const created = expectOk(createResult);

      // Pin
      const pinResult = conversationRepo.pin(created.id);
      const pinned = expectOk(pinResult);
      expect(pinned.pinned).toBe(true);

      // Unpin
      const unpinResult = conversationRepo.unpin(created.id);
      const unpinned = expectOk(unpinResult);
      expect(unpinned.pinned).toBe(false);
    });

    it('should get recent conversations', () => {
      // Create 3 conversations
      for (let i = 0; i < 3; i++) {
        conversationRepo.createConversation({
          title: `Test Conversation ${i + 1}`,
          model: 'claude-sonnet-4',
          modelTier: 'sonnet',
        });
      }

      const recentResult = conversationRepo.getRecent(10);
      const recent = expectOk(recentResult);

      expect(recent).toHaveLength(3);
    });

    it('should get pinned conversations', () => {
      const result1 = conversationRepo.createConversation({
        title: 'Pinned Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conv1 = expectOk(result1);
      conversationRepo.pin(conv1.id);

      conversationRepo.createConversation({
        title: 'Unpinned Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });

      const pinnedResult = conversationRepo.getPinned();
      const pinned = expectOk(pinnedResult);

      expect(pinned).toHaveLength(1);
      expect(pinned[0]?.title).toBe('Pinned Conversation');
    });

    it('should get conversation statistics', () => {
      // Create conversations
      conversationRepo.createConversation({
        title: 'Conv 1',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      conversationRepo.createConversation({
        title: 'Conv 2',
        model: 'claude-haiku-4',
        modelTier: 'haiku',
      });

      const statsResult = conversationRepo.getStatistics();
      const stats = expectOk(statsResult);

      expect(stats.totalConversations).toBe(2);
      expect(stats.conversationsByModelTier).toHaveProperty('sonnet', 1);
      expect(stats.conversationsByModelTier).toHaveProperty('haiku', 1);
    });
  });

  // ==========================================================================
  // MESSAGE CRUD
  // ==========================================================================

  describe('Message CRUD Operations', () => {
    it('should create a message', () => {
      const convResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conversation = expectOk(convResult);

      const msgResult = messageRepo.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
      });
      const message = expectOk(msgResult);

      expect(message.content).toBe('Test message');
      expect(message.conversationId).toBe(conversation.id);
      expect(getTableCount(db, 'messages')).toBe(1);
    });

    it('should find messages by conversation', () => {
      const convResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conversation = expectOk(convResult);

      // Create 3 messages
      for (let i = 0; i < 3; i++) {
        messageRepo.createMessage({
          conversationId: conversation.id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}`,
        });
      }

      const findResult = messageRepo.findByConversation(conversation.id);
      const messages = expectOk(findResult);

      expect(messages).toHaveLength(3);
      expect(messages.every((m) => m.conversationId === conversation.id)).toBe(
        true
      );
    });

    it('should get latest message', () => {
      const convResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conversation = expectOk(convResult);

      messageRepo.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'First message',
      });

      messageRepo.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Latest message',
      });

      const latestResult = messageRepo.getLatest(conversation.id);
      const latest = expectOk(latestResult);

      expect(latest).toBeDefined();
      expect(latest?.content).toBe('Latest message');
    });

    it('should delete message', () => {
      const convResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conversation = expectOk(convResult);

      const msgResult = messageRepo.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
      });
      const message = expectOk(msgResult);

      const deleteResult = messageRepo.delete(message.id);
      expect(deleteResult.ok).toBe(true);

      expect(getTableCount(db, 'messages')).toBe(0);
    });
  });

  // ==========================================================================
  // ATTACHMENT CRUD
  // ==========================================================================

  describe('Attachment CRUD Operations', () => {
    it('should create an attachment', () => {
      const convResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conversation = expectOk(convResult);

      const msgResult = messageRepo.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
      });
      const message = expectOk(msgResult);

      const attachResult = attachmentRepo.createAttachment({
        messageId: message.id,
        type: 'file',
        name: 'test.txt',
        size: 1024,
        mimeType: 'text/plain',
        base64Data: Buffer.from('test').toString('base64'),
      });
      const attachment = expectOk(attachResult);

      expect(attachment.name).toBe('test.txt');
      expect(attachment.messageId).toBe(message.id);
      expect(getTableCount(db, 'attachments')).toBe(1);
    });

    it('should find attachments by message', () => {
      const convResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conversation = expectOk(convResult);

      const msgResult = messageRepo.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
      });
      const message = expectOk(msgResult);

      // Create 3 attachments
      for (let i = 0; i < 3; i++) {
        attachmentRepo.createAttachment({
          messageId: message.id,
          type: 'file',
          name: `file${i + 1}.txt`,
          size: 1024,
          mimeType: 'text/plain',
          base64Data: Buffer.from('test').toString('base64'),
        });
      }

      const findResult = attachmentRepo.findByMessage(message.id);
      const attachments = expectOk(findResult);

      expect(attachments).toHaveLength(3);
      expect(attachments.every((a) => a.messageId === message.id)).toBe(true);
    });
  });

  // ==========================================================================
  // CASCADE DELETES
  // ==========================================================================

  describe('Cascading Deletes', () => {
    it('should cascade delete messages when conversation deleted', () => {
      const convResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conversation = expectOk(convResult);

      // Create 5 messages
      for (let i = 0; i < 5; i++) {
        messageRepo.createMessage({
          conversationId: conversation.id,
          role: 'user',
          content: `Message ${i + 1}`,
        });
      }

      expect(getTableCount(db, 'messages')).toBe(5);

      // Delete conversation
      conversationRepo.delete(conversation.id);

      // Messages should be deleted
      expect(getTableCount(db, 'messages')).toBe(0);
    });

    it('should cascade delete attachments when message deleted', () => {
      const convResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conversation = expectOk(convResult);

      const msgResult = messageRepo.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
      });
      const message = expectOk(msgResult);

      // Create 2 attachments
      for (let i = 0; i < 2; i++) {
        attachmentRepo.createAttachment({
          messageId: message.id,
          type: 'file',
          name: `file${i + 1}.txt`,
          size: 1024,
          mimeType: 'text/plain',
          base64Data: Buffer.from('test').toString('base64'),
        });
      }

      expect(getTableCount(db, 'attachments')).toBe(2);

      // Delete message
      messageRepo.delete(message.id);

      // Attachments should be deleted
      expect(getTableCount(db, 'attachments')).toBe(0);
    });

    it('should cascade delete entire conversation hierarchy', () => {
      const convResult = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const conversation = expectOk(convResult);

      const msgResult = messageRepo.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: 'Test message',
      });
      const message = expectOk(msgResult);

      attachmentRepo.createAttachment({
        messageId: message.id,
        type: 'file',
        name: 'test.txt',
        size: 1024,
        mimeType: 'text/plain',
        base64Data: Buffer.from('test').toString('base64'),
      });

      expect(getTableCount(db, 'conversations')).toBe(1);
      expect(getTableCount(db, 'messages')).toBe(1);
      expect(getTableCount(db, 'attachments')).toBe(1);

      // Delete conversation
      conversationRepo.delete(conversation.id);

      // Everything should be deleted
      expect(getTableCount(db, 'conversations')).toBe(0);
      expect(getTableCount(db, 'messages')).toBe(0);
      expect(getTableCount(db, 'attachments')).toBe(0);
    });
  });

  // ==========================================================================
  // TRANSACTION HANDLING
  // ==========================================================================

  describe('Transaction Handling', () => {
    it('should commit transaction on success', () => {
      const transaction = db.transaction(() => {
        for (let i = 0; i < 3; i++) {
          conversationRepo.createConversation({
            title: `Conv ${i + 1}`,
            model: 'claude-sonnet-4',
            modelTier: 'sonnet',
          });
        }
      });

      transaction();

      expect(getTableCount(db, 'conversations')).toBe(3);
    });

    it('should rollback transaction on error', () => {
      expect(() => {
        const transaction = db.transaction(() => {
          conversationRepo.createConversation({
            title: 'Valid Conversation',
            model: 'claude-sonnet-4',
            modelTier: 'sonnet',
          });

          // This will fail validation
          conversationRepo.createConversation({
            title: '', // Empty title should fail
            model: 'claude-sonnet-4',
            modelTier: 'sonnet',
          });
        });

        transaction();
      }).toThrow();

      // No conversations should be saved
      expect(getTableCount(db, 'conversations')).toBe(0);
    });
  });

  // ==========================================================================
  // TIMESTAMPS
  // ==========================================================================

  describe('Timestamp Handling', () => {
    it('should set createdAt on creation', () => {
      const result = conversationRepo.createConversation({
        title: 'Test Conversation',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const created = expectOk(result);

      expectRecentTimestamp(created.createdAt);
    });

    it('should update updatedAt on modification', async () => {
      const result = conversationRepo.createConversation({
        title: 'Original Title',
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });
      const created = expectOk(result);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updateResult = conversationRepo.updateTitle(
        created.id,
        'New Title'
      );
      const updated = expectOk(updateResult);

      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        created.createdAt.getTime()
      );
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  describe('Error Handling', () => {
    it('should return null for non-existent record', () => {
      const result = conversationRepo.findById('non-existent-id');
      const found = expectOk(result);
      expect(found).toBeNull();
    });

    it('should return error on constraint violation', () => {
      const result = messageRepo.createMessage({
        conversationId: 'non-existent-conversation',
        role: 'user',
        content: 'Test message',
      });

      expectErr(result); // Should fail foreign key constraint
    });

    it('should return error for invalid data', () => {
      const result = conversationRepo.createConversation({
        title: '', // Empty title
        model: 'claude-sonnet-4',
        modelTier: 'sonnet',
      });

      expectErr(result);
    });
  });
});
