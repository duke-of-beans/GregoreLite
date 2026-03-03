/**
 * BriefingSection — Sprint S9-05
 *
 * Reusable section wrapper for morning briefing cards.
 */

'use client';

interface BriefingSectionProps {
  icon: string;
  title: string;
  children: React.ReactNode;
}

export function BriefingSection({ icon, title, children }: BriefingSectionProps) {
  return (
    <div className="rounded-lg border border-[var(--shadow)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-semibold text-[var(--ice-white)]">{title}</h3>
      </div>
      <div className="text-sm text-[var(--frost)]">{children}</div>
    </div>
  );
}