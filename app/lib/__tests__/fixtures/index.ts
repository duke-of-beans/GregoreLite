/**
 * Test Fixtures - Test Data Generators
 *
 * Provides reusable test data for integration tests.
 * All fixtures generate valid repository domain objects.
 *
 * NOTE: Uses repository layer types (camelCase, Date objects)
 */

import type { Conversation } from '@/lib/repositories/conversation-repository';
import type { Message } from '@/lib/repositories/message-repository';
import type { Attachment } from '@/lib/repositories/attachment-repository';

// ============================================================================
// CONVERSATION FIXTURES
// ============================================================================

export const createTestConversation = (
  overrides?: Partial<Conversation>
): Conversation => ({
  id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  title: 'Test Conversation',
  model: 'claude-sonnet-4',
  modelTier: 'sonnet',
  createdAt: new Date(),
  updatedAt: new Date(),
  pinned: false,
  archived: false,
  totalTokens: 0,
  totalCost: 0,
  ...overrides,
});

export const createTestConversations = (count: number): Conversation[] => {
  return Array.from({ length: count }, (_, i) => {
    const now = Date.now();
    const createdAt = new Date(now - (count - i) * 1000); // Spread across time
    return createTestConversation({
      title: `Test Conversation ${i + 1}`,
      createdAt,
      updatedAt: createdAt,
    });
  });
};

// ============================================================================
// MESSAGE FIXTURES
// ============================================================================

export const createTestMessage = (
  conversationId: string,
  overrides?: Partial<Message>
): Message => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  conversationId,
  role: 'user',
  content: 'Test message content',
  model: null,
  inputTokens: null,
  outputTokens: null,
  cost: null,
  createdAt: new Date(),
  ...overrides,
});

export const createTestMessages = (
  conversationId: string,
  count: number
): Message[] => {
  return Array.from({ length: count }, (_, i) => {
    const isUser = i % 2 === 0;
    const now = Date.now();
    const createdAt = new Date(now - (count - i) * 1000);
    return createTestMessage(conversationId, {
      role: isUser ? 'user' : 'assistant',
      content: `Test ${isUser ? 'user' : 'assistant'} message ${i + 1}`,
      createdAt,
    });
  });
};

export const createUserMessage = (
  conversationId: string,
  content: string
): Message => {
  return createTestMessage(conversationId, {
    role: 'user',
    content,
  });
};

export const createAssistantMessage = (
  conversationId: string,
  content: string,
  model: string = 'claude-sonnet-4'
): Message => {
  return createTestMessage(conversationId, {
    role: 'assistant',
    content,
    model,
    inputTokens: 100,
    outputTokens: 200,
    cost: 0.0015,
  });
};

// ============================================================================
// ATTACHMENT FIXTURES
// ============================================================================

export const createTestAttachment = (
  messageId: string,
  overrides?: Partial<Attachment>
): Attachment => ({
  id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  messageId,
  type: 'file',
  name: 'test-file.txt',
  size: 1024,
  mimeType: 'text/plain',
  base64Data: Buffer.from('test content').toString('base64'),
  createdAt: new Date(),
  ...overrides,
});

export const createTestAttachments = (
  messageId: string,
  count: number
): Attachment[] => {
  return Array.from({ length: count }, (_, i) =>
    createTestAttachment(messageId, {
      name: `test-file-${i + 1}.txt`,
      size: 1024 * (i + 1),
    })
  );
};

export const createImageAttachment = (messageId: string): Attachment => {
  return createTestAttachment(messageId, {
    type: 'image',
    name: 'test-image.png',
    mimeType: 'image/png',
    size: 2048,
    base64Data: Buffer.from('fake image data').toString('base64'),
  });
};

export const createDocumentAttachment = (messageId: string): Attachment => {
  return createTestAttachment(messageId, {
    type: 'document',
    name: 'test-document.pdf',
    mimeType: 'application/pdf',
    size: 10240,
    base64Data: Buffer.from('fake pdf data').toString('base64'),
  });
};

// ============================================================================
// CONVERSATION + MESSAGES FIXTURES (composite)
// ============================================================================

export interface ConversationWithMessages {
  conversation: Conversation;
  messages: Message[];
}

export const createConversationWithMessages = (
  messageCount: number = 10
): ConversationWithMessages => {
  const conversation = createTestConversation();
  const messages = createTestMessages(conversation.id, messageCount);

  return { conversation, messages };
};

export const createMultipleConversationsWithMessages = (
  conversationCount: number,
  messagesPerConversation: number
): ConversationWithMessages[] => {
  return Array.from({ length: conversationCount }, () =>
    createConversationWithMessages(messagesPerConversation)
  );
};

// ============================================================================
// SEARCH TEST DATA
// ============================================================================

export const createSearchableConversations = (): ConversationWithMessages[] => {
  const conv1 = createTestConversation({
    title: 'Machine Learning Discussion',
    model: 'claude-sonnet-4',
    modelTier: 'sonnet',
  });

  const conv2 = createTestConversation({
    title: 'Python Programming Help',
    model: 'claude-haiku-4',
    modelTier: 'haiku',
  });

  const conv3 = createTestConversation({
    title: 'Database Design Questions',
    model: 'claude-opus-4',
    modelTier: 'opus',
  });

  return [
    {
      conversation: conv1,
      messages: [
        createUserMessage(conv1.id, 'What is machine learning?'),
        createAssistantMessage(
          conv1.id,
          'Machine learning is a subset of artificial intelligence...'
        ),
        createUserMessage(conv1.id, 'Tell me about neural networks'),
        createAssistantMessage(
          conv1.id,
          'Neural networks are computing systems inspired by biological neural networks...'
        ),
      ],
    },
    {
      conversation: conv2,
      messages: [
        createUserMessage(conv2.id, 'How do I use decorators in Python?'),
        createAssistantMessage(
          conv2.id,
          'Python decorators are a way to modify or enhance functions...'
        ),
      ],
    },
    {
      conversation: conv3,
      messages: [
        createUserMessage(conv3.id, 'What are database indexes?'),
        createAssistantMessage(
          conv3.id,
          'Database indexes are data structures that improve query performance...'
        ),
      ],
    },
  ];
};

// ============================================================================
// BULK OPERATION FIXTURES
// ============================================================================

export const createBulkMessages = (
  conversationId: string,
  count: number
): Message[] => {
  return Array.from({ length: count }, (_, i) => {
    const now = Date.now();
    return createTestMessage(conversationId, {
      content: `Bulk message ${i + 1}`,
      createdAt: new Date(now + i), // Ensure unique timestamps
    });
  });
};

export const createBulkAttachments = (
  messageId: string,
  count: number
): Attachment[] => {
  return Array.from({ length: count }, (_, i) =>
    createTestAttachment(messageId, {
      name: `bulk-file-${i + 1}.txt`,
      size: 512 * (i + 1),
    })
  );
};

// ============================================================================
// EDGE CASE FIXTURES
// ============================================================================

export const createEmptyConversation = (): Conversation => {
  return createTestConversation({
    title: 'Empty Conversation',
  });
};

export const createLongConversation = (): ConversationWithMessages => {
  const conversation = createTestConversation({
    title: 'Long Conversation with Many Messages',
  });

  const messages = createTestMessages(conversation.id, 1000);

  return { conversation, messages };
};

export const createConversationWithLargeMessage =
  (): ConversationWithMessages => {
    const conversation = createTestConversation();
    const largeContent = 'A'.repeat(100000); // 100KB message

    const messages = [
      createTestMessage(conversation.id, {
        content: largeContent,
      }),
    ];

    return { conversation, messages };
  };

export const createConversationWithManyAttachments = (): {
  conversation: Conversation;
  message: Message;
  attachments: Attachment[];
} => {
  const conversation = createTestConversation();
  const message = createTestMessage(conversation.id);
  const attachments = createTestAttachments(message.id, 50);

  return { conversation, message, attachments };
};
