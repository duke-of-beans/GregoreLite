/**
 * EoS Shared Types
 */

export type ScanMode = 'quick' | 'deep';

export interface HealthIssue {
  ruleId: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  file: string;
  line?: number;
}

export interface EoSScanResult {
  healthScore: number;
  issues: HealthIssue[];
  filesScanned: number;
  durationMs: number;
  suppressed: string[];
}

export interface RawIssue {
  type: string;
  severity: 'APOCALYPSE' | 'DANGER' | 'WARNING' | 'NOTICE' | string;
  file: string;
  line?: number;
  message?: string;
  description?: string;
  fix?: string;
}

export const SEVERITY_MAP: Record<string, HealthIssue['severity']> = {
  APOCALYPSE: 'critical',
  DANGER: 'critical',
  WARNING: 'warning',
  NOTICE: 'info',
};

export interface EoSConfig {
  maxFileSize: number;
  excludePatterns: RegExp[];
  fileExtensions: string[];
  batchSize: number;
  skipTests: boolean;
  maxSimilarIssues: number;
}

export const DEFAULT_CONFIG: EoSConfig = {
  maxFileSize: 1024 * 1024,
  excludePatterns: [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.next/,
    /coverage/,
    /out[\\/]/,
    /src-tauri[\\/]target/,
  ],
  fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  batchSize: 10,
  skipTests: true,
  maxSimilarIssues: 10,
};
