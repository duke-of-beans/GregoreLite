import { nanoid } from 'nanoid';
import { getDatabase } from './database';

export interface AegisSignal {
  id: string;
  profile: string;
  source_thread: string | null;
  sent_at: number;
  is_override: number;
}

export function getLatestAegisSignal(): AegisSignal | null {
  const db = getDatabase();
  return (
    db.prepare('SELECT * FROM aegis_signals ORDER BY sent_at DESC LIMIT 1').get() as AegisSignal
  ) ?? null;
}

export function logAegisSignal(profile: string, sourceThread?: string, isOverride = false): AegisSignal {
  const db = getDatabase();
  const id = nanoid();
  const now = Date.now();
  db.prepare(`
    INSERT INTO aegis_signals (id, profile, source_thread, sent_at, is_override)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, profile, sourceThread ?? null, now, isOverride ? 1 : 0);
  return getLatestAegisSignal()!;
}
