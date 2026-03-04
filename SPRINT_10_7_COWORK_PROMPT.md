Use Desktop Commander tools to read all files (not KERNL pm_read_file, not Filesystem MCP tools). 

First, read_file D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md for full architecture context.

Then read_file D:\Projects\GregLite\SPRINT_10_7_BRIEF.md and execute ALL 7 fixes described in it.

Fixes 1-5 are marked "ALREADY FIXED" — VERIFY each one by reading the file and confirming the fix is present. If the fix is NOT present, apply it. If it IS present, move on.

Fixes 6-7 are NEW — apply them exactly as described.

After all 7 fixes: run `cd /d D:\Projects\GregLite\app && npx tsc --noEmit` and fix any type errors until clean. Then stage and commit.

Use Desktop Commander for all file reads, writes, edits, and shell commands throughout execution.
