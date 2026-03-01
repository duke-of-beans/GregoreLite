/**
 * Indexer — Shared Types
 *
 * IndexerRun: result of a single runOnce() pass
 * IndexerStatus: public status surface (context panel, API)
 * ThrottleMode: AEGIS-driven speed control
 *
 * @module lib/indexer/types
 */

export type ThrottleMode = 'FULL' | 'HALF' | 'SKIP';

export interface IndexerRun {
  status: 'complete' | 'skipped' | 'error';
  reason?: string;          // why skipped or what errored
  chunksIndexed: number;
  elapsedMs: number;
}

export interface IndexerStatus {
  lastRun: number | null;             // timestamp of last completed run
  lastRunChunksIndexed: number;       // chunks indexed in last run
  unindexedCount: number;             // current unindexed chunk count
  isRunning: boolean;                 // actively indexing right now
  currentThrottle: ThrottleMode;      // FULL | HALF | SKIP
}
