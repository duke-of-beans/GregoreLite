/**
 * Portfolio Dashboard — Type Definitions
 * Sprint 24.0 + Sprint 25.0 + Sprint 26.0
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
  /** Sprint 26: attention muted until this timestamp (ms) — null = not muted */
  attentionMutedUntil?: number | null;
  /** Sprint 41: when this project was last scanned (ms epoch) — null = never */
  lastScannedAt?: number | null;
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
  /** Sprint 26: mute attention signals until this ms timestamp */
  attention_muted_until: number | null;
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

// ── Sprint 25.0 — Directory Scanner + Migration Types ────────────────────────

/** Raw scan of an UNREGISTERED directory (before onboarding) */
export interface DirectoryScanResult {
  /** Absolute path scanned */
  path: string;
  /** Build system files found (e.g. "package.json", "Cargo.toml") */
  buildSystem: string[];
  /** Version control info */
  versionControl: {
    hasGit: boolean;
    lastCommitDate: string | null;
    lastCommitMessage: string | null;
    branch: string | null;
  };
  /** Documentation files found (README.md, CHANGELOG.md, TODO, STATUS, etc.) */
  documentation: string[];
  /** Interesting directories present (src, lib, docs, tests, data, etc.) */
  structure: string[];
  /** Extension → file count map */
  fileDistribution: Record<string, number>;
  /** PROJECT_DNA.yaml already present? */
  existingDna: boolean;
  /** Total file count (skipped dirs excluded) */
  totalFiles: number;
  /** Total size in bytes (skipped dirs excluded) */
  totalSizeBytes: number;
}

/** Type inference result from a DirectoryScanResult */
export interface InferResult {
  type: ProjectType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/** A single question in the onboarding Q&A flow */
export interface OnboardingQuestion {
  id: string;
  question: string;
  context?: string;
  options?: string[];
}

/** Structured PROJECT_DNA content (used during DNA generation) */
export interface ProjectDnaYaml {
  type: ProjectType;
  type_label?: string;
  identity: {
    name: string;
    purpose: string;
  };
  current_state: {
    phase: string;
    status: string;
  };
  metrics: Record<string, string | number | null>;
  documents: string[];
}

/** Result of a migrateProject() operation */
export interface MigrationResult {
  success: boolean;
  archivePath?: string;
  newPath?: string;
  error?: string;
}

/** Warning found during pre-migration dependency scan */
export interface DependencyWarning {
  type: 'absolute-path' | 'symlink' | 'large-directory';
  path: string;
  detail: string;
  count?: number;
}

// ── Sprint 41.0 — Exclusion + API body types ─────────────────────────────────

export interface ExclusionRecord {
  path: string;
  excluded_at: number;
  reason: string | null;
}

export interface PatchProjectBody {
  name?: string;
  type?: ProjectType;
  status?: ProjectStatus;
}

export interface DeleteProjectBody {
  /** If true, add path to portfolio_exclusions so scanner won't re-add it */
  exclude?: boolean;
  reason?: string;
}

// ── Sprint 41.0 — lastScannedAt on ProjectCard for staleness indicator ────────
// (Injected by rowToCard in api/portfolio/route.ts from portfolio_projects.last_scanned_at)
// Declared as augmentation — added directly to ProjectCard below via interface merge.

// ── Sprint 26.0 — Scaffold + Attention Types ──────────────────────────────────

/** A single file definition in a scaffold template */
export interface ScaffoldFile {
  /** Relative path within the new project directory */
  path: string;
  /** File content — string or function that receives onboarding answers */
  content: string | ((answers: Record<string, string>) => string);
  /** Short human-readable description shown in scaffold preview step */
  description?: string;
}

/** A complete scaffold template for a project type */
export interface ScaffoldTemplate {
  type: ProjectType;
  /** Human-readable label for this template */
  label: string;
  /** Files to create in the new project directory */
  files: ScaffoldFile[];
}

/** Result of scaffolding a new project directory */
export interface ScaffoldResult {
  success: boolean;
  filesCreated: string[];
  error?: string;
}

/** Severity level for an attention item */
export type AttentionSeverity = 'high' | 'medium' | 'low';

/** A single item in the attention queue */
export interface AttentionItem {
  projectId: string;
  projectName: string;
  severity: AttentionSeverity;
  /** One-line reason in Greg's voice */
  reason: string;
  /** Suggested action for the user */
  actionSuggestion: string;
  /** What triggered this item: staleness | blockers | tests | deadline | velocity */
  triggerType: 'staleness' | 'blockers' | 'tests' | 'deadline' | 'velocity';
}

/** Infer result from a free-text description (Create New flow) */
export interface NewProjectInferResult {
  type: ProjectType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}
