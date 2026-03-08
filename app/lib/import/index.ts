/**
 * Import barrel — Sprint 34.0 / EPIC-81
 *
 * Re-exports the public surface of all import sub-modules.
 * Import from '@/lib/import' rather than individual files.
 */

export { startAutoIngest, stopAutoIngest, handleWatchfolderFile } from './auto-ingest';

export {
  getWatchfolderPath,
  setWatchfolderPath,
  ensureWatchfolderExists,
  getProcessedDir,
  DEFAULT_WATCHFOLDER,
  SUPPORTED_EXTENSIONS,
} from './watchfolder-config';

export {
  getDaysSinceSync,
  shouldShowReminder,
  getSyncReminderUrl,
  getReminderDays,
} from './sync-reminder';
