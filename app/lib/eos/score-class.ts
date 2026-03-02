/**
 * EoS health-score → CSS class mapping.
 *
 * Thresholds per PHASE5C brief: ≥80 green, ≥60 amber, <60 red.
 * Exported as a standalone utility so it can be used by both the
 * ContextPanel component and the War Room JobNode without bringing
 * in any React / DB dependencies.
 */
export function scoreClass(score: number): string {
  if (score >= 80) return 'text-[var(--success)]';
  if (score >= 60) return 'text-[var(--warning)]';
  return 'text-[var(--error)]';
}
