/**
 * Orchestration Patterns
 *
 * GREGORE's unique AI orchestration patterns that demonstrate
 * contextual intelligence and sophisticated model usage.
 *
 * These patterns represent competitive advantage - not commodity AI usage,
 * but intelligent orchestration that creates switching costs.
 *
 * @module services/patterns
 */

// Cascade Pattern
export {
  cascadeRequest,
  createStandardHierarchy,
  createCostOptimizedHierarchy,
  type CascadeModel,
  type CascadeOptions,
  type CascadeAttempt,
  type CascadeResult,
} from './cascade';

// Parallel Pattern
export {
  parallelRequests,
  parallelMapReduce,
  type ParallelResult,
  type ParallelOptions,
} from './parallel';

// Tribunal Pattern
export {
  tribunalRequest,
  type TribunalModel,
  type TribunalOptions,
  type TribunalResult,
} from './tribunal';

// Builder-Auditor Pattern
export {
  builderAuditorRequest,
  builderAuditorWithGhost,
  createCodeGenerationPattern,
  createConfigGenerationPattern,
  type BuilderConfig,
  type AuditorConfig,
  type AuditResult,
  type BuilderAuditorResult,
  type BuilderAuditorOptions,
} from './builder-auditor';

/**
 * Pattern Selection Guide
 *
 * Use this guide to choose the right orchestration pattern:
 *
 * CASCADE - Automatic fallback
 * - High-priority queries needing guaranteed response
 * - Cost optimization with quality fallback
 * - Rate limit handling
 * Example: Critical user support queries
 *
 * PARALLEL - Concurrent execution
 * - Multiple independent queries
 * - Batch processing
 * - Speed optimization
 * Example: Analyzing multiple documents simultaneously
 *
 * TRIBUNAL - Multi-model consensus
 * - Critical decisions requiring high confidence
 * - Fact-checking and verification
 * - Reducing hallucination risk
 * Example: Medical advice, legal analysis
 *
 * BUILDER-AUDITOR - Generate + validate
 * - Code generation with validation
 * - Configuration generation
 * - Critical outputs requiring verification
 * Example: Production code generation, system configs
 */
