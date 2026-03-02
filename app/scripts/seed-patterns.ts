/**
 * Seed PatternLearner with historical improvement records.
 *
 * Creates 20 realistic records spanning the task types that GregLite's
 * Agent SDK sessions actually run: code, test, docs, research, deploy.
 * After seeding, logs getTopPatterns(5) to confirm the learning engine works.
 *
 * Run:
 *   npx tsx scripts/seed-patterns.ts
 */

import { getPatternLearner } from '../lib/shim/pattern-learner.js';
import type { HistoricalImprovement } from '../lib/shim/types.js';

// nanoid-compatible random ID
function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const improvements: Omit<HistoricalImprovement, 'id' | 'timestamp'>[] = [
  // ── Code refactors (high success, high impact) ────────────────────────────
  {
    pattern: 'code',
    context: { complexity: 45, maintainability: 65, linesOfCode: 800 },
    modification: { type: 'refactor', impactScore: 15 },
    outcome: { success: true, complexityDelta: -10, maintainabilityDelta: 15 },
  },
  {
    pattern: 'code',
    context: { complexity: 60, maintainability: 50, linesOfCode: 1200 },
    modification: { type: 'extract-function', impactScore: 12 },
    outcome: { success: true, complexityDelta: -15, maintainabilityDelta: 20 },
  },
  {
    pattern: 'code',
    context: { complexity: 35, maintainability: 75, linesOfCode: 400 },
    modification: { type: 'type-annotation', impactScore: 5 },
    outcome: { success: true, complexityDelta: -2, maintainabilityDelta: 8 },
  },
  {
    pattern: 'code',
    context: { complexity: 70, maintainability: 40, linesOfCode: 2000 },
    modification: { type: 'split-module', impactScore: 20 },
    outcome: { success: true, complexityDelta: -25, maintainabilityDelta: 30 },
  },
  {
    pattern: 'code',
    context: { complexity: 55, maintainability: 55, linesOfCode: 600 },
    modification: { type: 'error-handling', impactScore: 8 },
    outcome: { success: false, complexityDelta: 5, maintainabilityDelta: -3 },
  },
  // ── Test additions (medium success) ──────────────────────────────────────
  {
    pattern: 'test',
    context: { complexity: 30, maintainability: 80, linesOfCode: 300 },
    modification: { type: 'unit-test', impactScore: 6 },
    outcome: { success: true, complexityDelta: 0, maintainabilityDelta: 10 },
  },
  {
    pattern: 'test',
    context: { complexity: 40, maintainability: 70, linesOfCode: 500 },
    modification: { type: 'integration-test', impactScore: 9 },
    outcome: { success: true, complexityDelta: 0, maintainabilityDelta: 12 },
  },
  {
    pattern: 'test',
    context: { complexity: 50, maintainability: 60, linesOfCode: 700 },
    modification: { type: 'coverage-expansion', impactScore: 7 },
    outcome: { success: true, complexityDelta: 0, maintainabilityDelta: 8 },
  },
  {
    pattern: 'test',
    context: { complexity: 65, maintainability: 45, linesOfCode: 1000 },
    modification: { type: 'mock-refactor', impactScore: 4 },
    outcome: { success: false, complexityDelta: 2, maintainabilityDelta: -1 },
  },
  // ── Documentation (low complexity, high maintainability gain) ─────────────
  {
    pattern: 'docs',
    context: { complexity: 20, maintainability: 85, linesOfCode: 200 },
    modification: { type: 'jsdoc', impactScore: 3 },
    outcome: { success: true, complexityDelta: 0, maintainabilityDelta: 5 },
  },
  {
    pattern: 'docs',
    context: { complexity: 25, maintainability: 80, linesOfCode: 150 },
    modification: { type: 'readme-update', impactScore: 2 },
    outcome: { success: true, complexityDelta: 0, maintainabilityDelta: 3 },
  },
  {
    pattern: 'docs',
    context: { complexity: 30, maintainability: 75, linesOfCode: 250 },
    modification: { type: 'inline-comment', impactScore: 2 },
    outcome: { success: true, complexityDelta: 0, maintainabilityDelta: 4 },
  },
  // ── Research / analysis tasks ─────────────────────────────────────────────
  {
    pattern: 'research',
    context: { complexity: 15, maintainability: 90, linesOfCode: 100 },
    modification: { type: 'dependency-audit', impactScore: 8 },
    outcome: { success: true, complexityDelta: -5, maintainabilityDelta: 6 },
  },
  {
    pattern: 'research',
    context: { complexity: 20, maintainability: 85, linesOfCode: 120 },
    modification: { type: 'pattern-analysis', impactScore: 5 },
    outcome: { success: true, complexityDelta: 0, maintainabilityDelta: 5 },
  },
  {
    pattern: 'research',
    context: { complexity: 25, maintainability: 80, linesOfCode: 80 },
    modification: { type: 'perf-profiling', impactScore: 10 },
    outcome: { success: false, complexityDelta: 0, maintainabilityDelta: 0 },
  },
  // ── Deploy tasks ──────────────────────────────────────────────────────────
  {
    pattern: 'deploy',
    context: { complexity: 35, maintainability: 70, linesOfCode: 300 },
    modification: { type: 'config-update', impactScore: 6 },
    outcome: { success: true, complexityDelta: -3, maintainabilityDelta: 5 },
  },
  {
    pattern: 'deploy',
    context: { complexity: 40, maintainability: 65, linesOfCode: 350 },
    modification: { type: 'env-var-migration', impactScore: 7 },
    outcome: { success: true, complexityDelta: -4, maintainabilityDelta: 7 },
  },
  {
    pattern: 'deploy',
    context: { complexity: 45, maintainability: 60, linesOfCode: 400 },
    modification: { type: 'schema-migration', impactScore: 10 },
    outcome: { success: true, complexityDelta: -5, maintainabilityDelta: 8 },
  },
  // ── Self-evolution (rare, high impact) ───────────────────────────────────
  {
    pattern: 'self_evolution',
    context: { complexity: 80, maintainability: 30, linesOfCode: 3000 },
    modification: { type: 'architecture-refactor', impactScore: 40 },
    outcome: { success: true, complexityDelta: -30, maintainabilityDelta: 35 },
  },
  {
    pattern: 'self_evolution',
    context: { complexity: 75, maintainability: 35, linesOfCode: 2500 },
    modification: { type: 'module-split', impactScore: 35 },
    outcome: { success: true, complexityDelta: -25, maintainabilityDelta: 30 },
  },
];

console.log('─'.repeat(60));
console.log('PatternLearner Seed — 20 historical improvement records');
console.log('─'.repeat(60));

const pl = getPatternLearner();

for (const imp of improvements) {
  pl.recordImprovement({ ...imp, id: uid(), timestamp: Date.now() });
}

console.log(`\nSeeded ${improvements.length} records.\n`);

const topPatterns = pl.getTopPatterns(5);
console.log('Top 5 patterns (by frequency × success rate):');
topPatterns.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.id.padEnd(16)} freq=${p.frequency}  successRate=${(p.successRate * 100).toFixed(0)}%  avgImpact=${p.averageImpact.toFixed(1)}`);
});

console.log('\nSample prediction (complexity=50, maintainability=60, loc=600):');
const predictions = pl.predictSuccess({ complexity: 50, maintainability: 60, linesOfCode: 600 });
predictions.slice(0, 3).forEach((pred, i) => {
  console.log(`  ${i + 1}. ${pred.pattern.padEnd(16)} confidence=${(pred.confidence * 100).toFixed(0)}%  expectedImpact=${pred.expectedImpact.toFixed(1)}`);
  console.log(`     ${pred.reasoning}`);
});

console.log('\n' + '─'.repeat(60));
console.log('Seed complete.');
