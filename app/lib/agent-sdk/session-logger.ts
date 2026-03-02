/**
 * Session Logger — Phase 7A
 *
 * In-memory ring buffer (10,000 lines) for raw SDK session output.
 * For sessions running longer than 5 minutes, output also streams to a
 * temp file at os.tmpdir()/greglite-session-{manifestId}.log.
 * The temp file path is stored in job_state.log_path.
 *
 * BLUEPRINT §4.3.2 — "Log buffer: 10,000 lines in memory, written to temp file
 *                     for sessions >5 minutes."
 */

import os from 'os';
import fs from 'fs';
import path from 'path';

const RING_BUFFER_CAPACITY = 10_000;
const TEMP_FILE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export class SessionLogger {
  private readonly manifestId: string;
  private readonly startedAt: number;

  /** Ring buffer — oldest line evicted when capacity is exceeded. */
  private buffer: string[] = [];

  /** Temp file write stream, opened lazily after threshold. */
  private fileStream: fs.WriteStream | null = null;
  private tempFilePath: string | null = null;
  private tempFileOpened = false;

  constructor(manifestId: string) {
    this.manifestId = manifestId;
    this.startedAt = Date.now();
  }

  /**
   * Append a line to the ring buffer and (if threshold exceeded) the temp file.
   * This is the only write path — safe to call on every SDK text event.
   */
  append(line: string): void {
    // Ring buffer: evict oldest if at capacity
    if (this.buffer.length >= RING_BUFFER_CAPACITY) {
      this.buffer.shift();
    }
    this.buffer.push(line);

    // Check if we should open a temp file
    if (!this.tempFileOpened && this.isOverThreshold()) {
      this.openTempFile();
    }

    // Write to temp file if open
    if (this.fileStream) {
      this.fileStream.write(line + '\n');
    }
  }

  /**
   * Return the last N lines from the ring buffer.
   * If n is not specified, returns all buffered lines.
   */
  getLines(n?: number): string[] {
    if (n === undefined || n >= this.buffer.length) {
      return [...this.buffer];
    }
    return this.buffer.slice(this.buffer.length - n);
  }

  /** How many lines are currently in the ring buffer. */
  get lineCount(): number {
    return this.buffer.length;
  }

  /** Temp file path — null until threshold exceeded. */
  get logPath(): string | null {
    return this.tempFilePath;
  }

  /**
   * Close the temp file stream gracefully.
   * Call this when the session ends.
   */
  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private isOverThreshold(): boolean {
    return Date.now() - this.startedAt >= TEMP_FILE_THRESHOLD_MS;
  }

  private openTempFile(): void {
    this.tempFileOpened = true;
    try {
      const fileName = `greglite-session-${this.manifestId}.log`;
      this.tempFilePath = path.join(os.tmpdir(), fileName);
      this.fileStream = fs.createWriteStream(this.tempFilePath, {
        flags: 'a',
        encoding: 'utf8',
      });
      this.fileStream.on('error', (err) => {
        console.warn('[SessionLogger] Temp file write error:', err.message);
        this.fileStream = null;
      });
      // Flush buffered lines to file on open
      const snapshot = [...this.buffer];
      for (const line of snapshot) {
        this.fileStream.write(line + '\n');
      }
    } catch (err) {
      console.warn('[SessionLogger] Failed to open temp file:', err);
      this.fileStream = null;
      this.tempFilePath = null;
    }
  }
}
