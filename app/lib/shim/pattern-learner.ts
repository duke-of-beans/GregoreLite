/**
 * SHIM PatternLearner — GregLite Port
 *
 * ML-based pattern recognition from historical job improvements.
 * Ported from D:\Projects\SHIM\src\ml\PatternLearner.ts
 *
 * Changes from original:
 *   - timestamp: Date → number (Unix ms)
 *   - Hydrates from KERNL shim_patterns + shim_improvements on init
 *   - Persists patterns back to KERNL after every recordImprovement()
 *   - Exports getPatternLearner() singleton factory
 *
 * MLPredictor (stub with Math.random()) is explicitly NOT migrated.
 */

import { getDatabase } from '../kernl/database';
import type { HistoricalImprovement, Pattern, PredictionScore } from './types';

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface PatternRow {
  id: string;
  description: string;
  frequency: number;
  success_rate: number;
  average_impact: number;
  contexts: string; // JSON array
  updated_at: number;
}

interface ImprovementRow {
  id: string;
  pattern: string;
  complexity: number | null;
  maintainability: number | null;
  lines_of_code: number | null;
  modification_type: string | null;
  impact_score: number | null;
  success: number;
  complexity_delta: number | null;
  maintainability_delta: number | null;
  recorded_at: number;
}

// ─── PatternLearner class ─────────────────────────────────────────────────────

export class PatternLearner {
  private history: HistoricalImprovement[];
  private patterns: Map<string, Pattern>;

  constructor() {
    this.history = [];
    this.patterns = new Map();
    this.hydrate();
  }

  // ─── KERNL hydration ───────────────────────────────────────────────────────

  private hydrate(): void {
    try {
      const db = getDatabase();

      const patternRows = db
        .prepare('SELECT * FROM shim_patterns ORDER BY updated_at DESC')
        .all() as PatternRow[];

      for (const row of patternRows) {
        let contexts: Pattern['contexts'] = [];
        try {
          contexts = JSON.parse(row.contexts) as Pattern['contexts'];
        } catch {
          // Malformed JSON — skip contexts for this pattern
        }
        this.patterns.set(row.id, {
          id: row.id,
          description: row.description,
          frequency: row.frequency,
          successRate: row.success_rate,
          averageImpact: row.average_impact,
          contexts,
        });
      }

      const impRows = db
        .prepare('SELECT * FROM shim_improvements ORDER BY recorded_at ASC')
        .all() as ImprovementRow[];

      for (const row of impRows) {
        this.history.push({
          id: row.id,
          pattern: row.pattern,
          context: {
            complexity: row.complexity ?? 50,
            maintainability: row.maintainability ?? 50,
            linesOfCode: row.lines_of_code ?? 0,
          },
          modification: {
            type: row.modification_type ?? 'unknown',
            impactScore: row.impact_score ?? 0,
          },
          outcome: {
            success: row.success === 1,
            complexityDelta: row.complexity_delta ?? 0,
            maintainabilityDelta: row.maintainability_delta ?? 0,
          },
          timestamp: row.recorded_at,
        });
      }
    } catch (err) {
      // DB not yet initialised (e.g. during testing without full KERNL bootstrap)
      console.warn('[PatternLearner] hydrate skipped:', err instanceof Error ? err.message : err);
    }
  }

  // ─── KERNL persistence ─────────────────────────────────────────────────────

  private persistPatterns(): void {
    try {
      const db = getDatabase();
      const upsert = db.prepare(`
        INSERT INTO shim_patterns
          (id, description, frequency, success_rate, average_impact, contexts, updated_at)
        VALUES
          (@id, @description, @frequency, @successRate, @averageImpact, @contexts, @updatedAt)
        ON CONFLICT(id) DO UPDATE SET
          description    = excluded.description,
          frequency      = excluded.frequency,
          success_rate   = excluded.success_rate,
          average_impact = excluded.average_impact,
          contexts       = excluded.contexts,
          updated_at     = excluded.updated_at
      `);

      const upsertAll = db.transaction(() => {
        for (const pattern of this.patterns.values()) {
          upsert.run({
            id: pattern.id,
            description: pattern.description,
            frequency: pattern.frequency,
            successRate: pattern.successRate,
            averageImpact: pattern.averageImpact,
            contexts: JSON.stringify(pattern.contexts),
            updatedAt: Date.now(),
          });
        }
      });

      upsertAll();
    } catch (err) {
      console.warn('[PatternLearner] persistPatterns failed:', err instanceof Error ? err.message : err);
    }
  }

  private persistImprovement(improvement: HistoricalImprovement): void {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT OR IGNORE INTO shim_improvements (
          id, pattern, complexity, maintainability, lines_of_code,
          modification_type, impact_score, success,
          complexity_delta, maintainability_delta, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        improvement.id,
        improvement.pattern,
        improvement.context.complexity,
        improvement.context.maintainability,
        improvement.context.linesOfCode,
        improvement.modification.type,
        improvement.modification.impactScore,
        improvement.outcome.success ? 1 : 0,
        improvement.outcome.complexityDelta,
        improvement.outcome.maintainabilityDelta,
        improvement.timestamp,
      );
    } catch (err) {
      console.warn('[PatternLearner] persistImprovement failed:', err instanceof Error ? err.message : err);
    }
  }

  // ─── Public API (mirrors SHIM original) ────────────────────────────────────

  recordImprovement(improvement: HistoricalImprovement): void {
    this.history.push(improvement);
    this.persistImprovement(improvement);
    this.updatePatterns();
    this.persistPatterns();
  }

  learnPatterns(): Pattern[] {
    this.updatePatterns();
    return Array.from(this.patterns.values());
  }

  predictSuccess(context: {
    complexity: number;
    maintainability: number;
    linesOfCode: number;
  }): PredictionScore[] {
    const scores: PredictionScore[] = [];

    this.patterns.forEach((pattern) => {
      const similarity = this.calculateSimilarity(context, pattern.contexts);
      const confidence = similarity * pattern.successRate;
      const expectedImpact = pattern.averageImpact * confidence;

      scores.push({
        pattern: pattern.description,
        confidence,
        expectedImpact,
        reasoning: this.generateReasoning(pattern, similarity),
      });
    });

    return scores.sort((a, b) => b.confidence - a.confidence);
  }

  getTopPatterns(limit = 5): Pattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.successRate * b.frequency - a.successRate * a.frequency)
      .slice(0, limit);
  }

  getPatternStats(): {
    totalPatterns: number;
    totalImprovements: number;
    averageSuccessRate: number;
  } {
    const patterns = Array.from(this.patterns.values());
    const avgSuccess =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length
        : 0;

    return {
      totalPatterns: patterns.length,
      totalImprovements: this.history.length,
      averageSuccessRate: avgSuccess,
    };
  }

  // ─── Private helpers (identical to SHIM) ───────────────────────────────────

  private updatePatterns(): void {
    const patternGroups = new Map<string, HistoricalImprovement[]>();

    this.history.forEach((improvement) => {
      const { pattern } = improvement;
      if (!patternGroups.has(pattern)) {
        patternGroups.set(pattern, []);
      }
      patternGroups.get(pattern)!.push(improvement);
    });

    patternGroups.forEach((improvements, patternKey) => {
      const successes = improvements.filter((i) => i.outcome.success).length;
      const totalImpact = improvements.reduce(
        (sum, i) => sum + i.modification.impactScore,
        0,
      );

      const pattern: Pattern = {
        id: patternKey,
        description: patternKey,
        frequency: improvements.length,
        successRate: successes / improvements.length,
        averageImpact: totalImpact / improvements.length,
        contexts: improvements.map((i) => i.context),
      };

      this.patterns.set(patternKey, pattern);
    });
  }

  private calculateSimilarity(
    context: { complexity: number; maintainability: number; linesOfCode: number },
    patterns: Array<{ complexity: number; maintainability: number; linesOfCode: number }>,
  ): number {
    if (patterns.length === 0) return 0;

    const similarities = patterns.map((p) => {
      const complexityDiff = Math.abs(context.complexity - p.complexity);
      const maintDiff = Math.abs(context.maintainability - p.maintainability);
      const locDiff = Math.abs(context.linesOfCode - p.linesOfCode);

      const complexitySim = 1 - Math.min(complexityDiff / 100, 1);
      const maintSim = 1 - Math.min(maintDiff / 100, 1);
      const locSim = 1 - Math.min(locDiff / 10_000, 1);

      return (complexitySim + maintSim + locSim) / 3;
    });

    return similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  }

  private generateReasoning(pattern: Pattern, similarity: number): string {
    return (
      `Pattern "${pattern.description}" has ${pattern.frequency} occurrences ` +
      `with ${(pattern.successRate * 100).toFixed(1)}% success rate. ` +
      `Context similarity: ${(similarity * 100).toFixed(1)}%.`
    );
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _instance: PatternLearner | null = null;

/**
 * Returns the process-wide PatternLearner singleton.
 * Lazy-initialised on first call; hydrates from KERNL on construction.
 */
export function getPatternLearner(): PatternLearner {
  if (!_instance) {
    _instance = new PatternLearner();
  }
  return _instance;
}

/** Reset singleton (test isolation only). */
export function _resetPatternLearner(): void {
  _instance = null;
}
