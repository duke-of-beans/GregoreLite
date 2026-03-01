/**
 * Cascade Pattern
 *
 * Automatic model fallback pattern for resilience and cost optimization.
 * Tries models in order (e.g., Opus → Sonnet → Haiku) until success.
 *
 * Use Cases:
 * - High-priority queries that need guaranteed response
 * - Cost optimization with fallback to cheaper models
 * - Handling rate limits and availability issues
 *
 * @module services/patterns/cascade
 */

import { AISDKService, AIRequest, AIResponse, AIProvider } from '../ai-sdk-service';

/**
 * Model tier classification (simplified from router)
 */
export type ModelTier = 'HAIKU' | 'SONNET' | 'OPUS' | 'PRO';

/**
 * Model in cascade hierarchy
 */
export interface CascadeModel {
  provider: AIProvider;
  model: string;
  tier: ModelTier;
}

/**
 * Cascade configuration
 */
export interface CascadeOptions {
  /** Models to try in order (highest quality first) */
  modelHierarchy: CascadeModel[];
  /** Maximum retries per model */
  maxRetriesPerModel?: number;
  /** Timeout per model attempt (ms) */
  timeoutMs?: number;
  /** Whether to track cost of failed attempts */
  trackFailedAttempts?: boolean;
}

/**
 * Cascade attempt result
 */
export interface CascadeAttempt {
  model: CascadeModel;
  success: boolean;
  response?: AIResponse;
  error?: Error;
  attemptNumber: number;
}

/**
 * Cascade result
 */
export interface CascadeResult {
  /** Final successful response */
  response: AIResponse;
  /** All attempts made */
  attempts: CascadeAttempt[];
  /** Total cost including failed attempts */
  totalCost: number;
  /** Which model succeeded */
  successfulModel: CascadeModel;
  /** Number of models tried before success */
  modelsTriedCount: number;
}

/**
 * Execute cascade pattern
 *
 * Tries models in hierarchy order until one succeeds.
 * Optimizes for both quality and cost by starting with best model
 * and falling back to cheaper options.
 *
 * @param request - Base AI request (model will be overridden)
 * @param options - Cascade configuration
 * @returns Cascade result with response and attempts
 * @throws Error if all models fail
 */
export async function cascadeRequest(
  request: Omit<AIRequest, 'provider' | 'model'>,
  options: CascadeOptions
): Promise<CascadeResult> {
  const service = new AISDKService();
  const attempts: CascadeAttempt[] = [];
  let totalCost = 0;

  const maxRetries = options.maxRetriesPerModel ?? 1;
  // trackFailed reserved for future cost tracking of failed attempts

  // Try each model in hierarchy
  for (let modelIndex = 0; modelIndex < options.modelHierarchy.length; modelIndex++) {
    const cascadeModel = options.modelHierarchy[modelIndex];
    if (!cascadeModel) continue; // Safety check
    
    const isLastModel = modelIndex === options.modelHierarchy.length - 1;

    // Try this model with retries
    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
      const attemptNumber = attempts.length + 1;

      try {
        // Execute request with timeout
        const response = await executeWithTimeout(
          () => service.complete({
            ...request,
            provider: cascadeModel.provider,
            model: cascadeModel.model,
          }),
          options.timeoutMs ?? 30000
        );

        // Success! Record attempt and return
        attempts.push({
          model: cascadeModel,
          success: true,
          response,
          attemptNumber,
        });

        totalCost += response.cost;

        return {
          response,
          attempts,
          totalCost,
          successfulModel: cascadeModel,
          modelsTriedCount: modelIndex + 1,
        };

      } catch (error) {
        // Record failed attempt
        const attempt: CascadeAttempt = {
          model: cascadeModel,
          success: false,
          error: error as Error,
          attemptNumber,
        };
        attempts.push(attempt);

        // If tracking failed attempts and we have cost info, add it
        // (Note: Cost tracking for failed attempts may not be available)

        // If this is the last retry of the last model, throw
        if (isLastModel && retryCount === maxRetries - 1) {
          throw new Error(
            `Cascade failed: All models exhausted. Attempts: ${attempts.length}. ` +
            `Last error: ${(error as Error).message}`
          );
        }

        // If not last retry, continue to next retry
        if (retryCount < maxRetries - 1) {
          continue;
        }

        // Otherwise, break to try next model
        break;
      }
    }
  }

  // Should never reach here due to throw above, but TypeScript needs it
  throw new Error('Cascade failed: Unexpected state');
}

/**
 * Execute a promise with timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Create standard model hierarchy (Opus → Sonnet → Haiku)
 */
export function createStandardHierarchy(provider: AIProvider = 'anthropic'): CascadeModel[] {
  if (provider === 'anthropic') {
    return [
      {
        provider: 'anthropic',
        model: 'claude-opus-4-20250514',
        tier: 'OPUS',
      },
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        tier: 'SONNET',
      },
      {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        tier: 'HAIKU',
      },
    ];
  } else if (provider === 'openai') {
    return [
      {
        provider: 'openai',
        model: 'o1-preview',
        tier: 'OPUS',
      },
      {
        provider: 'openai',
        model: 'gpt-4o',
        tier: 'SONNET',
      },
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        tier: 'HAIKU',
      },
    ];
  }

  throw new Error(`No standard hierarchy defined for provider: ${provider}`);
}

/**
 * Create cost-optimized hierarchy (start cheap, escalate if needed)
 */
export function createCostOptimizedHierarchy(provider: AIProvider = 'anthropic'): CascadeModel[] {
  // Reverse of standard (Haiku → Sonnet → Opus)
  return createStandardHierarchy(provider).reverse();
}
