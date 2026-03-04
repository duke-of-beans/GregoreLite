/**
 * Transit Map — Capture Unit Tests
 *
 * Tests for lib/transit/capture.ts:
 *   - captureEvent() writes a row to the DB with correct fields
 *   - captureEvent() never throws on DB error
 *   - captureEvent() uses crypto.randomUUID() for IDs
 *   - getEventsForConversation() returns parsed EventMetadata[]
 *   - getEventsForConversation() returns [] on DB error
 *   - getEventsByType() returns parsed EventMetadata[], respects limit
 *   - getEventsByType() returns [] on DB error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock setup ─────────────────────────────────────────────────────────────
// vi.hoisted required — factory must be evaluated before module graph runs

const { mockRun, mockAll, mockPrepare, mockDb } = vi.hoisted(() => {
  const mockRun     = vi.fn();
  const mockAll     = vi.fn().mockReturnValue([]);
  const mockPrepare = vi.fn().mockReturnValue({ run: mockRun, all: mockAll });
  const mockDb      = { prepare: mockPrepare };
  return { mockRun, mockAll, mockPrepare, mockDb };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn().mockReturnValue(mockDb),
}));

import { captureEvent, getEventsForConversation, getEventsByType } from '../capture';

// ── captureEvent() ────────────────────────────────────────────────────────────

describe('captureEvent()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll });
  });

  it('calls db.prepare with an INSERT statement', () => {
    captureEvent({
      conversation_id: 'conv-1',
      event_type: 'flow.message',
      category: 'flow',
    });
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO conversation_events'),
    );
  });

  it('calls run() with the correct positional parameters', () => {
    captureEvent({
      conversation_id: 'conv-1',
      message_id: 'msg-42',
      event_type: 'quality.interruption',
      category: 'quality',
      payload: { partial_content_length: 150 },
    });

    expect(mockRun).toHaveBeenCalledOnce();
    const args = mockRun.mock.calls[0] as unknown[];
    // args: [id, conversation_id, message_id, event_type, category, payload]
    expect(args[0]).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    expect(args[1]).toBe('conv-1');
    expect(args[2]).toBe('msg-42');
    expect(args[3]).toBe('quality.interruption');
    expect(args[4]).toBe('quality');
    expect(args[5]).toBe('{"partial_content_length":150}');
  });

  it('defaults message_id to null when not provided', () => {
    captureEvent({
      conversation_id: 'conv-2',
      event_type: 'flow.session_boundary',
      category: 'flow',
    });
    const args = mockRun.mock.calls[0] as unknown[];
    expect(args[2]).toBeNull();
  });

  it('defaults payload to {} when not provided', () => {
    captureEvent({
      conversation_id: 'conv-3',
      event_type: 'system.error',
      category: 'system',
    });
    const args = mockRun.mock.calls[0] as unknown[];
    expect(args[5]).toBe('{}');
  });

  it('generates a different UUID for each call', () => {
    captureEvent({ conversation_id: 'c', event_type: 'flow.message', category: 'flow' });
    captureEvent({ conversation_id: 'c', event_type: 'flow.message', category: 'flow' });
    const id1 = (mockRun.mock.calls[0] as unknown[])[0] as string;
    const id2 = (mockRun.mock.calls[1] as unknown[])[0] as string;
    expect(id1).not.toBe(id2);
  });

  it('never throws when db.prepare throws', () => {
    mockPrepare.mockImplementationOnce(() => { throw new Error('DB unavailable'); });
    expect(() => captureEvent({
      conversation_id: 'c',
      event_type: 'flow.message',
      category: 'flow',
    })).not.toThrow();
  });

  it('never throws when run() throws', () => {
    mockRun.mockImplementationOnce(() => { throw new Error('constraint violation'); });
    expect(() => captureEvent({
      conversation_id: 'c',
      event_type: 'flow.message',
      category: 'flow',
    })).not.toThrow();
  });
});

// ── getEventsForConversation() ────────────────────────────────────────────────

describe('getEventsForConversation()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll });
  });

  it('queries by conversation_id', () => {
    mockAll.mockReturnValue([]);
    getEventsForConversation('conv-99');
    expect(mockAll).toHaveBeenCalledWith('conv-99');
  });

  it('parses DB rows into EventMetadata objects', () => {
    const row = {
      id: 'evt-1',
      conversation_id: 'conv-1',
      message_id: 'msg-1',
      event_type: 'flow.message',
      category: 'flow',
      payload: '{"role":"user"}',
      created_at: 1700000000000,
    };
    mockAll.mockReturnValue([row]);
    const results = getEventsForConversation('conv-1');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'evt-1',
      conversation_id: 'conv-1',
      message_id: 'msg-1',
      event_type: 'flow.message',
      category: 'flow',
      payload: { role: 'user' },
      created_at: 1700000000000,
    });
  });

  it('returns empty array when db.prepare throws', () => {
    mockPrepare.mockImplementationOnce(() => { throw new Error('DB error'); });
    const result = getEventsForConversation('conv-1');
    expect(result).toEqual([]);
  });
});

// ── getEventsByType() ─────────────────────────────────────────────────────────

describe('getEventsByType()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll });
  });

  it('queries by event_type with default limit of 100', () => {
    mockAll.mockReturnValue([]);
    getEventsByType('quality.interruption');
    expect(mockAll).toHaveBeenCalledWith('quality.interruption', 100);
  });

  it('respects a custom limit', () => {
    mockAll.mockReturnValue([]);
    getEventsByType('flow.message', 25);
    expect(mockAll).toHaveBeenCalledWith('flow.message', 25);
  });

  it('parses DB rows into EventMetadata objects', () => {
    const row = {
      id: 'evt-2',
      conversation_id: 'conv-5',
      message_id: null,
      event_type: 'quality.interruption',
      category: 'quality',
      payload: '{"tokens_generated":42}',
      created_at: 1700000001000,
    };
    mockAll.mockReturnValue([row]);
    const results = getEventsByType('quality.interruption');
    expect(results[0]).toMatchObject({
      id: 'evt-2',
      event_type: 'quality.interruption',
      payload: { tokens_generated: 42 },
    });
  });

  it('returns empty array when db.prepare throws', () => {
    mockPrepare.mockImplementationOnce(() => { throw new Error('DB error'); });
    const result = getEventsByType('flow.message');
    expect(result).toEqual([]);
  });
});
