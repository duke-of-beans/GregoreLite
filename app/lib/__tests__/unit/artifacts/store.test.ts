/**
 * Artifact Zustand Store — Unit Tests
 * Sprint 2D
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useArtifactStore } from '@/lib/artifacts/store';
import type { Artifact } from '@/lib/artifacts/types';

const mockArtifact: Artifact = {
  id: 'test-artifact-id',
  type: 'code',
  language: 'typescript',
  content: 'export const sprint = "2D";',
};

describe('useArtifactStore', () => {
  beforeEach(() => {
    // Reset store to clean state before each test
    useArtifactStore.setState({ activeArtifact: null });
  });

  it('starts with no active artifact', () => {
    const { activeArtifact } = useArtifactStore.getState();
    expect(activeArtifact).toBeNull();
  });

  it('setArtifact opens the panel with the given artifact', () => {
    useArtifactStore.getState().setArtifact(mockArtifact);
    const { activeArtifact } = useArtifactStore.getState();
    expect(activeArtifact).not.toBeNull();
    expect(activeArtifact!.id).toBe('test-artifact-id');
    expect(activeArtifact!.type).toBe('code');
    expect(activeArtifact!.language).toBe('typescript');
  });

  it('setArtifact replaces the previous artifact', () => {
    const first: Artifact = { ...mockArtifact, id: 'first', content: 'const a = 1;' };
    const second: Artifact = { ...mockArtifact, id: 'second', content: 'const b = 2;' };

    useArtifactStore.getState().setArtifact(first);
    expect(useArtifactStore.getState().activeArtifact!.id).toBe('first');

    useArtifactStore.getState().setArtifact(second);
    expect(useArtifactStore.getState().activeArtifact!.id).toBe('second');
  });

  it('clearArtifact closes the panel', () => {
    useArtifactStore.getState().setArtifact(mockArtifact);
    expect(useArtifactStore.getState().activeArtifact).not.toBeNull();

    useArtifactStore.getState().clearArtifact();
    expect(useArtifactStore.getState().activeArtifact).toBeNull();
  });

  it('clearArtifact is idempotent when already null', () => {
    expect(useArtifactStore.getState().activeArtifact).toBeNull();
    expect(() => useArtifactStore.getState().clearArtifact()).not.toThrow();
    expect(useArtifactStore.getState().activeArtifact).toBeNull();
  });

  it('stores the full artifact including optional threadId', () => {
    const withThread: Artifact = { ...mockArtifact, threadId: 'thread-abc-123' };
    useArtifactStore.getState().setArtifact(withThread);
    expect(useArtifactStore.getState().activeArtifact!.threadId).toBe('thread-abc-123');
  });

  it('stores react and html artifact types correctly', () => {
    const reactArtifact: Artifact = { ...mockArtifact, type: 'react', language: 'jsx' };
    useArtifactStore.getState().setArtifact(reactArtifact);
    expect(useArtifactStore.getState().activeArtifact!.type).toBe('react');

    const htmlArtifact: Artifact = { ...mockArtifact, type: 'html', language: 'html' };
    useArtifactStore.getState().setArtifact(htmlArtifact);
    expect(useArtifactStore.getState().activeArtifact!.type).toBe('html');
  });
});
