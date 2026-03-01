// Continuity module — diff-based crash recovery
// Single import surface for all consumers

export { checkpoint, restore, getLastActiveThread } from './checkpoint';
export { computeDiff, replayDiffs, extractKnownIds } from './diff';
export type { ConversationDiff, RestoredConversation, DiffMessage } from './types';
