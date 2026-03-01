/**
 * Orchestration Patterns
 *
 * GregLite carries the Cascade pattern from the Gregore scaffold.
 * Parallel, Tribunal, and Builder-Auditor are Gregore Full features
 * (multi-model). They are not included in GregLite (single-model).
 *
 * @module services/patterns
 */

// Cascade Pattern — cost-tiered fallback, used by worker sessions
export {
  cascadeRequest,
  createStandardHierarchy,
  createCostOptimizedHierarchy,
  type CascadeModel,
  type CascadeOptions,
  type CascadeAttempt,
  type CascadeResult,
} from './cascade';
