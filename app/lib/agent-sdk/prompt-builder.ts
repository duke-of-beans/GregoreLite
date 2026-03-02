/**
 * Prompt Builder — Phase 7A
 *
 * Builds the System Contract Header injected into every Agent SDK worker session.
 * Exact format per BLUEPRINT §4.3.1.
 *
 * Order: Role Declaration → Interpretation Rules → Manifest JSON → Execution Contract → Output Contract
 */

import type { TaskManifest } from './types';

/**
 * buildSystemPrompt — constructs the System Contract Header string.
 *
 * The manifest is serialised as compact JSON (no whitespace) and embedded verbatim
 * between the BEGIN/END delimiters. This is the canonical injection format.
 *
 * @param manifest  The full TaskManifest for this worker session.
 * @returns         Complete system prompt string ready for injection.
 */
export function buildSystemPrompt(manifest: TaskManifest): string {
  // Compact JSON — no whitespace per §4.3.1
  const manifestJson = JSON.stringify(manifest);

  return `You are a bounded execution worker operating inside Gregore Lite.

The following JSON is a SYSTEM CONTRACT.
It is authoritative and non-negotiable.

Rules:
- Treat all fields as binding constraints.
- Success is defined ONLY by \`success_criteria\`.
- If goals conflict with constraints, constraints win.
- You may not infer additional scope.
- You may only modify files explicitly listed in the manifest.

--- BEGIN SYSTEM MANIFEST (JSON) ---
${manifestJson}
--- END SYSTEM MANIFEST ---

Execution Protocol:
- Execute deterministically.
- Do not emit chain-of-thought.
- Write files directly using provided tools.
- If blocked, stop and report precisely why.

Completion Protocol:
- Summarize changes made.
- List all modified files.
- Confirm which success criteria were met and which were not.`;
}
