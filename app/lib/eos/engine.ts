/**
 * EoS Scan Engine
 *
 * Orchestrates file discovery, parallel analysis, issue normalisation,
 * health score computation, and FP suppression.
 *
 * Internal surface — public callers use index.ts.
 */

import fs from 'fs';
import path from 'path';

import type { EoSConfig, EoSScanResult, HealthIssue, RawIssue, ScanMode } from './types.js';
import { DEFAULT_CONFIG, SEVERITY_MAP } from './types.js';
import { analyzeCharacters } from './character.js';
import { analyzePatterns } from './patterns.js';
import { processBatch } from './batch.js';
import { computeHealthScore } from './health-score.js';
import { getSuppressedRules } from './fp-tracker.js';

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function shouldExclude(filePath: string, config: EoSConfig): boolean {
  return config.excludePatterns.some((re) => re.test(filePath));
}

function discoverFiles(rootPath: string, config: EoSConfig): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!shouldExclude(fullPath, config)) walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!config.fileExtensions.includes(ext)) continue;
        if (shouldExclude(fullPath, config)) continue;
        if (
          config.skipTests &&
          (entry.name.includes('.test.') ||
            entry.name.includes('.spec.') ||
            fullPath.includes('__tests__'))
        ) {
          continue;
        }
        files.push(fullPath);
      }
    }
  }

  walk(rootPath);
  return files;
}

// ---------------------------------------------------------------------------
// Per-file analysis
// ---------------------------------------------------------------------------

async function analyseFile(filePath: string, config: EoSConfig): Promise<RawIssue[]> {
  let content: string;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > config.maxFileSize) return [];
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  return [
    ...analyzeCharacters(content, filePath),
    ...analyzePatterns(content, filePath),
  ];
}

// ---------------------------------------------------------------------------
// Issue normalisation
// ---------------------------------------------------------------------------

function normaliseIssues(
  rawIssues: RawIssue[],
  suppressed: Set<string>,
): { issues: HealthIssue[]; suppressedRuleIds: string[] } {
  const issues: HealthIssue[] = [];
  const suppressedHit = new Set<string>();

  for (const raw of rawIssues) {
    if (suppressed.has(raw.type)) {
      suppressedHit.add(raw.type);
      continue;
    }
    const severity = SEVERITY_MAP[raw.severity] ?? 'info';
    const issue: HealthIssue = {
      ruleId: raw.type,
      severity,
      message: raw.message ?? raw.description ?? raw.type,
      file: raw.file,
    };
    if (raw.line !== undefined) issue.line = raw.line;
    issues.push(issue);
  }

  return { issues, suppressedRuleIds: Array.from(suppressedHit) };
}

// ---------------------------------------------------------------------------
// Exported scan functions
// ---------------------------------------------------------------------------

export async function scanFiles(
  filePaths: string[],
  projectId?: string,
  config: Partial<EoSConfig> = {},
): Promise<EoSScanResult> {
  const cfg: EoSConfig = { ...DEFAULT_CONFIG, ...config };
  const start = Date.now();

  const suppressed = projectId ? getSuppressedRules(projectId) : new Set<string>();

  const { results, errors } = await processBatch(
    filePaths,
    (fp) => analyseFile(fp, cfg),
    { batchSize: cfg.batchSize },
  );

  if (errors.length > 0) {
    console.warn(`[EoS] ${errors.length} file(s) failed analysis`);
  }

  const allRaw = results.flat();
  const { issues, suppressedRuleIds } = normaliseIssues(allRaw, suppressed);
  const { score } = computeHealthScore(issues);

  return {
    healthScore: score,
    issues,
    filesScanned: filePaths.length,
    durationMs: Date.now() - start,
    suppressed: suppressedRuleIds,
  };
}

export async function scan(
  projectPath: string,
  mode: ScanMode = 'quick',
  projectId?: string,
): Promise<EoSScanResult> {
  const config: Partial<EoSConfig> =
    mode === 'quick'
      ? { skipTests: true, maxSimilarIssues: 5 }
      : { skipTests: false, maxSimilarIssues: 10 };

  const cfg: EoSConfig = { ...DEFAULT_CONFIG, ...config };
  const filePaths = discoverFiles(projectPath, cfg);
  return scanFiles(filePaths, projectId, config);
}
