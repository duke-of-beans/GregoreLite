// KERNL — Native SQLite persistence module
// Single import surface for all consumers

export { getDatabase, closeDatabase } from './database';

export {
  createThread,
  getThread,
  listThreads,
  updateThreadTitle,
  deleteThread,
  addMessage,
  getMessage,
  getThreadMessages,
  getLastNMessages,
  searchMessages,
} from './session-manager';

export {
  logDecision,
  getDecision,
  listDecisions,
  getDecisionsByCategory,
  getDecisionsForThread,
  parseAlternatives,
} from './decision-store';

export {
  writeCheckpoint,
  getCheckpoint,
  getLatestCheckpoint,
  restoreFromCheckpoint,
  checkpointThread,
  pruneCheckpoints,
} from './checkpoint';

export {
  createProject,
  getProject,
  listProjects,
  getActiveProject,
  upsertProject,
  touchProject,
} from './project-store';

export {
  getLatestAegisSignal,
  logAegisSignal,
} from './aegis-store';

export type { AegisSignal } from './aegis-store';

export type {
  Thread,
  Message,
  Decision,
  Project,
  Artifact,
  Checkpoint,
  Workstream,
  Pattern,
  CreateThreadInput,
  CreateMessageInput,
  CreateDecisionInput,
  CreateProjectInput,
  CreateCheckpointInput,
} from './types';
