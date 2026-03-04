/**
 * Transit Map Learning Engine — Public API
 * Sprint 11.7
 *
 * Re-exports the surface area callers need.
 * Internal detector modules are NOT re-exported — use runLearningPipeline().
 */

// Pipeline
export {
  runLearningPipeline,
  startLearningScheduler,
  stopLearningScheduler,
} from './pipeline';

// Registry CRUD
export {
  storeInsight,
  getAllInsights,
  getInsightsByStatus,
  applyInsight,
  dismissInsight,
  rollbackInsight,
  decayExpiredInsights,
} from './registry';

// Types
export type {
  LearningInsight,
  InsightStatus,
  InsightAdjustment,
  PatternResult,
  LearningInsightRow,
} from './types';
