'use client';
/**
 * WarRoomEmpty — empty state shown when manifests table is empty.
 * Sprint 2E — Dependency Graph UI
 */


export function WarRoomEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--shadow)] bg-[var(--elevated)] text-3xl">
        🗺️
      </div>
      <div>
        <h3 className="text-base font-semibold text-[var(--ice-white)]">
          No active jobs
        </h3>
        <p className="mt-1 text-sm text-[var(--mist)]">
          Spawn a worker session from the Workers tab to see the dependency graph here.
        </p>
      </div>
    </div>
  );
}
