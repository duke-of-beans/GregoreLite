import fs from 'fs';
import type { DevProtocols } from './types';

const DEV_PROTOCOL_PATHS = {
  technicalStandards: 'D:\\Dev\\TECHNICAL_STANDARDS.md',
  claudeInstructions: 'D:\\Dev\\CLAUDE_INSTRUCTIONS.md',
} as const;

// Cap file size to avoid bloating system prompt (first 8KB per file)
const MAX_BYTES = 8 * 1024;

function readProtocolFile(filePath: string): { content: string | null; error: string | null } {
  try {
    if (!fs.existsSync(filePath)) {
      return { content: null, error: `File not found: ${filePath}` };
    }

    const buffer = Buffer.alloc(MAX_BYTES);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, MAX_BYTES, 0);
    fs.closeSync(fd);

    const content = buffer.subarray(0, bytesRead).toString('utf8');
    // Trim at last newline to avoid mid-word cuts
    const lastNewline = content.lastIndexOf('\n');
    return {
      content: lastNewline > 0 ? content.substring(0, lastNewline) : content,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: null, error: `Failed to load ${filePath}: ${msg}` };
  }
}

/**
 * Load dev protocol files from disk.
 * Never throws — returns nulls with error messages on failure.
 */
export function loadDevProtocols(): DevProtocols {
  const loadErrors: string[] = [];

  const ts = readProtocolFile(DEV_PROTOCOL_PATHS.technicalStandards);
  if (ts.error) loadErrors.push(ts.error);

  const ci = readProtocolFile(DEV_PROTOCOL_PATHS.claudeInstructions);
  if (ci.error) loadErrors.push(ci.error);

  if (loadErrors.length > 0) {
    console.warn('[bootstrap:dev-protocols] Load warnings:', loadErrors);
  }

  return {
    technicalStandards: ts.content,
    claudeInstructions: ci.content,
    loadErrors,
  };
}
