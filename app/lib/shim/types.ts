/**
 * SHIM PatternLearner Types — GregLite Port
 *
 * Ported from D:\Projects\SHIM\src\ml\PatternLearner.ts
 * Key change: timestamp uses number (Unix ms) instead of Date
 * for consistency with KERNL's integer timestamps throughout GregLite.
 */

export interface HistoricalImprovement {
  id: string;
  pattern: string;
  context: {
    complexity: number;
    maintainability: number;
    linesOfCode: number;
  };
  modification: {
    type: string;
    impactScore: number;
  };
  outcome: {
    success: boolean;
    complexityDelta: number;
    maintainabilityDelta: number;
  };
  /** Unix milliseconds (was Date in SHIM original) */
  timestamp: number;
}

export interface Pattern {
  id: string;
  description: string;
  frequency: number;
  successRate: number;
  averageImpact: number;
  contexts: Array<{
    complexity: number;
    maintainability: number;
    linesOfCode: number;
  }>;
}

export interface PredictionScore {
  pattern: string;
  confidence: number;
  expectedImpact: number;
  reasoning: string;
}
