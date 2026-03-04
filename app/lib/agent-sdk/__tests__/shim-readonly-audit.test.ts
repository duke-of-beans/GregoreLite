/**
 * shim-readonly-audit.test.ts — Sprint 11.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runShimReadonlyAudit } from '../tools/shim-readonly-audit';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
  },
}));

vi.mock('../../../lib/eos/engine', () => ({
  scan: vi.fn(),
  scanFiles: vi.fn(),
}));

import fs from 'fs';
import { scan, scanFiles } from '../../eos/engine';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockStatSync   = vi.mocked(fs.statSync);
const mockScan       = vi.mocked(scan);
const mockScanFiles  = vi.mocked(scanFiles);

const MOCK_SCAN_RESULT = {
  healthScore: 82,
  issues: [
    { ruleId: 'no-console', severity: 'warning' as const, message: 'No console.log', file: '/f.ts', line: 5 },
  ],
  filesScanned: 3,
  durationMs: 120,
  suppressed: [],
};

describe('runShimReadonlyAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error result for nonexistent path', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await runShimReadonlyAudit('/does/not/exist');

    expect(result.healthScore).toBe(0);
    expect(result.grade).toBe('D');
    expect(result.fileCount).toBe(0);
    expect(result.issues[0]?.rule).toBe('path_not_found');
  });

  it('scans a single file via scanFiles', async () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true } as ReturnType<typeof fs.statSync>);
    mockScanFiles.mockResolvedValue(MOCK_SCAN_RESULT);

    const result = await runShimReadonlyAudit('/some/file.ts');

    expect(mockScanFiles).toHaveBeenCalledWith(['/some/file.ts']);
    expect(result.healthScore).toBe(82);
    expect(result.grade).toBe('B');
    expect(result.fileCount).toBe(3);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.rule).toBe('no-console');
  });

  it('scans a directory via scan with deep mode', async () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => false } as ReturnType<typeof fs.statSync>);
    mockScan.mockResolvedValue({ ...MOCK_SCAN_RESULT, healthScore: 55, filesScanned: 10 });

    const result = await runShimReadonlyAudit('/some/dir');

    expect(mockScan).toHaveBeenCalledWith('/some/dir', 'deep');
    expect(result.healthScore).toBe(55);
    expect(result.grade).toBe('C');
    expect(result.fileCount).toBe(10);
  });

  it('assigns correct grades for score ranges', async () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => false } as ReturnType<typeof fs.statSync>);

    for (const [score, expectedGrade] of [[95, 'A'], [80, 'B'], [65, 'C'], [40, 'D']] as const) {
      mockScan.mockResolvedValue({ ...MOCK_SCAN_RESULT, healthScore: score });
      const r = await runShimReadonlyAudit('/dir');
      expect(r.grade).toBe(expectedGrade);
    }
  });
});
