/**
 * Services Module
 *
 * Centralized services for GREGORE.
 *
 * Exports:
 * - AISDKService: Vercel AI SDK wrapper
 * - Pricing utilities
 * - Orchestration patterns (Cascade, Parallel, Tribunal, Builder-Auditor)
 *
 * References:
 * - LEAN-OUT Migration
 * - Checkpoint 3.2: Orchestration Patterns
 */

// AI SDK Service
export { AISDKService } from './ai-sdk-service';
export type {
  AIProvider,
  ModelTier,
  AIRequest,
  AIResponse,
  StreamCallback,
} from './ai-sdk-service';

// Pricing
export { calculateCost, getModelPricing } from './pricing';
export type { ModelPricing, ModelCost } from './pricing';

// Orchestration Patterns
export {
  // Cascade
  cascadeRequest,
  createStandardHierarchy,
  createCostOptimizedHierarchy,
  // Parallel
  parallelRequests,
  parallelMapReduce,
  // Tribunal
  tribunalRequest,
  // Builder-Auditor
  builderAuditorRequest,
  builderAuditorWithGhost,
  createCodeGenerationPattern,
  createConfigGenerationPattern,
} from './patterns';

export type {
  // Cascade types
  CascadeModel,
  CascadeOptions,
  CascadeAttempt,
  CascadeResult,
  // Parallel types
  ParallelResult,
  ParallelOptions,
  // Tribunal types
  TribunalModel,
  TribunalOptions,
  TribunalResult,
  // Builder-Auditor types
  BuilderConfig,
  AuditorConfig,
  AuditResult,
  BuilderAuditorResult,
  BuilderAuditorOptions,
} from './patterns';
