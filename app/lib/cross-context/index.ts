/**
 * Cross-Context Engine — public API barrel (Sprint 3E + 3F)
 */

// Types
export type {
  FeedbackAction,
  SurfaceContext,
  ThresholdConfig,
  Suggestion,
  CalibrationResult,
  SuggestionRow,
} from './types';

// Thresholds
export {
  THRESHOLD_MIN,
  THRESHOLD_MAX,
  DRIFT_PER_EVENT,
  CONSECUTIVE_DISMISSAL_DRIFT,
  DEFAULT_THRESHOLDS,
  clamp,
  loadThresholds,
  saveThresholds,
  adjustThreshold,
} from './thresholds';

// Calibrator
export { runCalibration, getLastCalibrationTime } from './calibrator';

// Feedback
export { insertSuggestion, recordFeedback } from './feedback';

// Surfacing
export {
  getRecencyFactor,
  getDismissalPenalty,
  isSuppressed,
  rankAndFilter,
  MIN_DISPLAY_SCORE,
} from './surfacing';

// Gate (Sprint 3F)
export type { GateMatch, GateResult } from './gate';
export { checkBeforeManifest } from './gate';

// Override tracker (Sprint 3F)
export { recordOverride, getOverrideCount } from './override-tracker';
