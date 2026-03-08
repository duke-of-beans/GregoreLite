/**
 * ZIP Handler — extract conversations.json from a ZIP or parse bare JSON
 * Sprint 33.0 / EPIC-81
 *
 * extractConversationsJson() handles both:
 *   - ZIP archives (detected by PK\x03\x04 magic bytes) → extract conversations.json
 *   - Raw JSON buffers → parse directly
 *
 * Throws if extraction fails (caller wraps in try/catch at upload boundary).
 */

import JSZip from 'jszip';

/** ZIP magic bytes: PK\x03\x04 */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

/**
 * Returns true if the buffer begins with ZIP magic bytes (PK\x03\x04).
 */
export function isZipBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === ZIP_MAGIC[0] &&
    buffer[1] === ZIP_MAGIC[1] &&
    buffer[2] === ZIP_MAGIC[2] &&
    buffer[3] === ZIP_MAGIC[3]
  );
}

/**
 * Extract and parse conversations.json from a ZIP buffer.
 * Also handles bare JSON (not zipped) — detected by magic bytes.
 *
 * @throws Error if ZIP contains no conversations.json, or JSON is unparseable.
 */
export async function extractConversationsJson(buffer: Buffer): Promise<unknown> {
  if (isZipBuffer(buffer)) {
    const zip = await JSZip.loadAsync(buffer);

    // Find conversations.json — may be at root or nested in a subdirectory
    const directFile = zip.file('conversations.json');
    const nestedFile =
      directFile ??
      Object.values(zip.files).find(
        (f) => !f.dir && f.name.endsWith('/conversations.json'),
      );

    if (!nestedFile) {
      throw new Error('No conversations.json found in ZIP archive');
    }

    const jsonText = await nestedFile.async('text');
    return JSON.parse(jsonText) as unknown;
  }

  // Not a ZIP — parse as raw JSON
  return JSON.parse(buffer.toString('utf-8')) as unknown;
}
