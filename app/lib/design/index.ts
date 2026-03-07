/**
 * Design System — barrel export
 * Sprint 21.0 + Sprint 28.0
 */

export {
  transitions,
  fadeIn,
  slideInRight,
  slideInLeft,
  modalVariants,
  popoverVariants,
  drawerSlide,
  drawerSlideLeft,
  panelSlideUp,
  expandCollapse,
  buttonPress,
  cardLift,
  useAnimationConfig,
} from './animations';

// Sprint 28.0 — Synthesis ceremony animations
export {
  prefersReducedMotion,
  TYPEWRITER_SPEED,
  getTypewriterDelay,
  getTypewriterSlice,
  isTypewriterComplete,
  getCounterValue,
  COUNTER_DURATION_MS,
  STAGGER_DELAY_MS,
  staggerContainer,
  staggerChild,
  masterReveal,
  sectionReveal,
  capabilityCard,
  sourceCardSpring,
  snippetFade,
} from './synthesis-animations';
