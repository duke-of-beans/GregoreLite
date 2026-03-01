/**
 * Services Module
 *
 * Centralized services for GregLite.
 *
 * Exports:
 * - AISDKService: Vercel AI SDK wrapper
 * - Pricing utilities
 * - Orchestration patterns (Cascade only — GregLite is single-model)
 *
 * Parallel, Tribunal, Builder-Auditor patterns are Gregore Full features
 * and are not present in GregLite.
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

// Orchestration Patterns (Cascade only)
export {
  cascadeRequest,
  createStandardHierarchy,
  createCostOptimizedHierarchy,
} from './patterns';

export type {
  CascadeModel,
  CascadeOptions,
  CascadeAttempt,
  CascadeResult,
} from './patterns';
