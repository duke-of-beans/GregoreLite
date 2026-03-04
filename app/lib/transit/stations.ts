/**
 * Station auto-generation — Sprint 11.5 (Z2 Subway View)
 *
 * Reads enriched conversation events and produces an ordered list of
 * subway stations for the Z2 map renderer.
 *
 * RULE: Zero hardcoded event type checks here. Station eligibility is
 * determined entirely by the `station` config on each registry entry.
 * Adding a new station trigger = adding a station config to registry.ts.
 *
 * Spec: TRANSIT_MAP_SPEC.md §3.3
 */

import type { EnrichedEvent, Station } from './types';

// ── Template resolver ─────────────────────────────────────────────────────────

/**
 * Replace {payload.field} tokens with values from the event payload.
 * Falls back to the raw token text if the field is absent.
 *
 * @example
 * resolveTemplate('Artifact: {payload.artifact_type}', { artifact_type: 'code' })
 * // → 'Artifact: code'
 */
export function resolveTemplate(
  template: string,
  payload: Record<string, unknown>,
): string {
  return template.replace(/\{payload\.([^}]+)\}/g, (_, key: string) => {
    const val = payload[key as keyof typeof payload];
    return val != null ? String(val) : key;
  });
}

// ── Station generation ────────────────────────────────────────────────────────

/**
 * Generate stations from enriched conversation events.
 *
 * Only events whose registry entry has `station.enabled === true` produce
 * stations. Manual stations (source: 'manual') pass through unchanged —
 * they are identified by having `event_type === 'transit.manual_station'`
 * or by explicit station config on a manual-station registry entry.
 *
 * Returns stations sorted ascending by messageIndex.
 */
export function generateStations(events: EnrichedEvent[]): Station[] {
  const stations: Station[] = [];

  for (const event of events) {
    const stationConfig = event.config?.station;
    if (!stationConfig?.enabled) continue;

    const messageIndex = event.message_index ?? 0;
    const name = resolveTemplate(stationConfig.nameTemplate, event.payload);
    // Icon can also be a template token (e.g. transit.manual_station uses {payload.icon})
    const icon = resolveTemplate(stationConfig.icon, event.payload);
    const source: Station['source'] =
      event.event_type === 'transit.manual_station' ? 'manual' : 'auto';

    stations.push({
      id: event.id,
      eventId: event.id,
      messageId: event.message_id ?? null,
      messageIndex,
      name,
      icon,
      source,
    });
  }

  // Sort by message position for left-to-right layout
  stations.sort((a, b) => a.messageIndex - b.messageIndex);

  return stations;
}
