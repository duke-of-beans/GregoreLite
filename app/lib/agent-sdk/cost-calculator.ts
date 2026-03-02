/**
 * cost-calculator.ts — Phase 7D
 *
 * Reads model pricing from pricing.yaml (same directory).
 * The file is watched for changes and the cache is invalidated automatically,
 * so Anthropic price changes never require a code change.
 *
 * Key lookup strategy (reconciles versioned SDK model IDs with short yaml keys):
 *   1. Exact key match         e.g. "claude-sonnet-4-5-20250929"
 *   2. Strip trailing date     e.g. "claude-sonnet-4-5"  (removes -YYYYMMDD suffix)
 *   3. Strip to family name    e.g. "claude-sonnet"      (removes trailing -N-N segments)
 *   4. Warn + return 0.00      (never crash on unknown model)
 *
 * BLUEPRINT §4.3.5
 */

import fs from 'fs';
import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelRates {
  input_per_million: number;
  output_per_million: number;
}

// ─── YAML path ────────────────────────────────────────────────────────────────

const PRICING_YAML_PATH = path.join(__dirname, 'pricing.yaml');

// ─── Cache ────────────────────────────────────────────────────────────────────

let cachedPricing: Record<string, ModelRates> | null = null;

/**
 * Manually invalidate the pricing cache (e.g. after file change).
 * Also called by the fs.watch handler below.
 */
export function reloadPricing(): void {
  cachedPricing = null;
}

// Watch for file changes and bust the cache automatically.
// fs.watch is non-blocking; if the file doesn't exist yet it is a no-op.
try {
  fs.watch(PRICING_YAML_PATH, () => {
    cachedPricing = null;
  });
} catch {
  // File not found at module load — harmless; next call to loadPricing() will try again.
}

// ─── Tiny YAML parser (handles the specific pricing.yaml format) ──────────────
//
// Parses:
//   models:
//     model-name:
//       input_per_million: 3.00
//       output_per_million: 15.00
//
// We don't depend on a third-party YAML library to keep the bundle small and
// avoid a new dependency.  The format is intentionally constrained.

function parsePricingYaml(raw: string): Record<string, ModelRates> {
  const result: Record<string, ModelRates> = {};
  const lines = raw.split('\n');

  let inModels = false;
  let currentModel: string | null = null;
  let inputPer1M = 0;
  let outputPer1M = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/, '');

    // Skip blank lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Top-level "models:" sentinel
    if (/^models:/.test(line)) {
      inModels = true;
      continue;
    }

    if (!inModels) continue;

    // Two-space indent: model name key  e.g. "  claude-sonnet-4-5:"
    const modelMatch = /^  ([\w.-]+):/.exec(line);
    if (modelMatch) {
      // Flush the previous model if we have one
      if (currentModel) {
        result[currentModel] = { input_per_million: inputPer1M, output_per_million: outputPer1M };
      }
      currentModel = modelMatch[1] ?? null;
      inputPer1M = 0;
      outputPer1M = 0;
      continue;
    }

    // Four-space indent: key/value  e.g. "    input_per_million: 3.00"
    if (currentModel) {
      const inputMatch = /^ {4}input_per_million:\s*([\d.]+)/.exec(line);
      if (inputMatch) { inputPer1M = parseFloat(inputMatch[1] ?? '0'); continue; }
      const outputMatch = /^ {4}output_per_million:\s*([\d.]+)/.exec(line);
      if (outputMatch) { outputPer1M = parseFloat(outputMatch[1] ?? '0'); continue; }
    }
  }

  // Flush final model
  if (currentModel) {
    result[currentModel] = { input_per_million: inputPer1M, output_per_million: outputPer1M };
  }

  return result;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

function loadPricing(): Record<string, ModelRates> {
  if (cachedPricing) return cachedPricing;
  try {
    const raw = fs.readFileSync(PRICING_YAML_PATH, 'utf8');
    cachedPricing = parsePricingYaml(raw);
    return cachedPricing;
  } catch (err) {
    console.warn('[cost-calculator] Failed to load pricing.yaml:', err);
    cachedPricing = {};
    return cachedPricing;
  }
}

// ─── Model lookup (with fallback chain) ──────────────────────────────────────

export function getPricingForModel(model: string): ModelRates {
  const pricing = loadPricing();

  // 1. Exact key
  if (pricing[model]) return pricing[model];

  // 2. Strip trailing -YYYYMMDD suffix  e.g. claude-sonnet-4-5-20250929 → claude-sonnet-4-5
  const withoutDate = model.replace(/-\d{8}$/, '');
  if (withoutDate !== model && pricing[withoutDate]) return pricing[withoutDate];

  // 3. Strip trailing numeric version segments  e.g. claude-sonnet-4-5 → claude-sonnet-4
  const withoutMinor = withoutDate.replace(/-\d+$/, '');
  if (withoutMinor !== withoutDate && pricing[withoutMinor]) return pricing[withoutMinor];

  // 4. Unknown model — log and return zero-cost (never crash)
  console.warn(`[cost-calculator] No pricing for model: "${model}". Cost will be $0.00.`);
  return { input_per_million: 0, output_per_million: 0 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate USD cost for a given token count + model.
 *
 * @param inputTokens  - number of input (prompt) tokens
 * @param outputTokens - number of output (completion) tokens
 * @param model        - Anthropic model string (exact or versioned)
 * @returns            - estimated cost in USD
 */
export function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
  const rates = getPricingForModel(model);
  return (inputTokens / 1_000_000) * rates.input_per_million
       + (outputTokens / 1_000_000) * rates.output_per_million;
}
