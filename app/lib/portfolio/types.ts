/**
 * Portfolio Dashboard — Type Definitions
 * Sprint 24.0
 *
 * Covers: ProjectType, ProjectHealth, ProjectCard, ScanResult, PortfolioProject.
 * Scanner reads disk, produces ScanResult → normalized into ProjectCard for UI.
 * PortfolioProject mirrors the SQLite portfolio_projects row shape.
 */

// ── Core enumerations ─────────────────────────────────────────────────────────

export type ProjectType = 'code' | 'research' | 'business' | 'creative' | 'custom';

export type ProjectHealth = 'green' | 'amber' | 'red';

export type ProjectStatus = 'active' | 'paused' | 'archived';

// ── ProjectCard — what the UI renders ────────────────────────────────────────

export interface ProjectCard {
  /** Stable identifier — workspace key from WORKSPACES.yaml or generated UUID */
  id: string;
  /** Display name */
  name: string;
  /** Absolute path on disk */
  path: string;
  /** Primary project type */
  type: ProjectType;
  /** Human label for 'custom' type or display override */
  typeLabel: string;
  /** Registry status */
  status: ProjectStatus;
  /** Semver from DNA or STATUS.md (e.g. "1.1.0") */
  version: string | null;
  /** Current phase or sprint summary (1 line) */
  phase: string | null;
  /** ISO 8601 — most recent meaningful activity */
  lastActivity: string | null;
  /** Health signal */
  health: ProjectHealth;
  /** Why health is what it is — shown in tooltip */
  healthReason: string;
  /** One-line summary of what's next (from STATUS.md "Next:" or similar) */
  nextAction: string | null;
  /** Code projects: test count from STATUS.md */
  testCount?: number;
  /** Code projects: passing tests */
  testPassing?: number;
  /** Code projects: TypeScript error count */
  tscErrors?: number;
  /** Type-specific metrics — flexible key/value pairs */
  customMetrics: Record<string, string | number>;
}

// ── ScanResult — raw data from a single project scan ─────────────────────────

export interface ScanResult {
  /** Path that was scanned */
  path: string;
  /** Whether the path exists and is accessible */
  accessible: boolean;
  /** Contents of PROJECT_DNA.yaml (parsed) or null if absent */
  dna: Record<string, unknown> | null;
  /** First 20 lines of STATUS.md or null if absent */
  statusExcerpt: string | null;
  /** Full STATUS.md text (for detail panel) */
  statusFull: string | null;
  /** Last git commit ISO timestamp — filled async; null until available */
  lastCommit: string | null;
  /** Last git commit message */
  lastCommitMessage: string | null;
  /** Current git branch */
  gitBranch: string | null;
  /** Whether path has .git directory */
  hasGit: boolean;
  /** Whether path has package.json */
  hasPackageJson: boolean;
  /** Detected type from markers */
  detectedType: ProjectType;
  /** Scan timestamp (ISO) */
  scannedAt: string;
  /** Non-fatal warnings during scan */
  warnings: string[];
}

// ── PortfolioProject — SQLite row shape ───────────────────────────────────────

export interface PortfolioProject {
  id: string;
  name: string;
  path: string;
  type: ProjectType;
  type_label: string | null;
  status: ProjectStatus;
  registered_at: number;
  last_scanned_at: number | null;
  /** JSON blob — parsed ScanResult + computed ProjectCard fields */
  scan_data: string | null;
}

// ── Parsed scan_data blob stored in SQLite ────────────────────────────────────

export interface PortfolioScanData {
  version: string | null;
  phase: string | null;
  lastCommit: string | null;
  lastCommitMessage: string | null;
  branch: string | null;
  testCount: number | null;
  testPassing: number | null;
  tscErrors: number | null;
  nextAction: string | null;
  blockers: string[];
  health: ProjectHealth;
  healthReason: string;
  customMetrics: Record<string, string | number>;
  statusExcerpt: string | null;
  statusFull: string | null;
  warnings: string[];
  scannedAt: string;
}
