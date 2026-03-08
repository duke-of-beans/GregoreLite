/**
 * Tour step definitions — Sprint 39.0
 *
 * TOUR_STEPS drives the 10-step onboarding tooltip tour.
 * All copy strings are sourced from TOUR in copy-templates.ts — nothing hardcoded here.
 * If a target selector is not found in the DOM, TourTooltip skips the step silently.
 *
 * data-tour attributes added to:
 *   - InputField textarea         → data-tour="chat-input"
 *   - ChatInterface workers tab   → data-tour="workers-tab"   (already present Sprint 38)
 *   - ChatInterface war-room tab  → data-tour="war-room-tab"  (already present Sprint 38)
 *   - ChatInterface transit tab   → data-tour="transit-tab"   (added Sprint 39)
 *   - Header projects button      → data-tour="projects-button" (added Sprint 39)
 *   - Header settings button      → data-tour="settings-gear" (already present Sprint 38)
 *   - StatusBar root element      → data-tour="status-bar"    (already present Sprint 30)
 *   - ShimmerOverlay root         → data-tour="memory-shimmer" (already present Sprint 38)
 *   - ContextPanel root           → data-tour="context-panel"  (verify in ContextPanel)
 *   - InspectorDrawer button/root → data-tour="inspector-drawer" (verify in InspectorDrawer)
 */

import { TOUR } from '@/lib/voice/copy-templates';

export type TourPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  id: string;
  target: string;            // CSS selector used with document.querySelector
  title: string;
  body: string;
  position: TourPosition;
  spotlightPadding?: number; // extra px around the target cutout
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'chat-input',
    target: "[data-tour='chat-input']",
    title: TOUR.steps[0].title,
    body:  TOUR.steps[0].body,
    position: 'top',
    spotlightPadding: 8,
  },
  {
    id: 'memory-shimmer',
    target: "[data-tour='memory-shimmer']",
    title: TOUR.steps[1].title,
    body:  TOUR.steps[1].body,
    position: 'top',
    spotlightPadding: 6,
  },
  {
    id: 'context-panel',
    target: "[data-tour='context-panel']",
    title: TOUR.steps[2].title,
    body:  TOUR.steps[2].body,
    position: 'right',
    spotlightPadding: 4,
  },
  {
    id: 'workers-tab',
    target: "[data-tour='workers-tab']",
    title: TOUR.steps[3].title,
    body:  TOUR.steps[3].body,
    position: 'bottom',
    spotlightPadding: 4,
  },
  {
    id: 'war-room-tab',
    target: "[data-tour='war-room-tab']",
    title: TOUR.steps[4].title,
    body:  TOUR.steps[4].body,
    position: 'bottom',
    spotlightPadding: 4,
  },
  {
    id: 'transit-tab',
    target: "[data-tour='transit-tab']",
    title: TOUR.steps[5].title,
    body:  TOUR.steps[5].body,
    position: 'bottom',
    spotlightPadding: 4,
  },
  {
    id: 'inspector-drawer',
    target: "[data-tour='inspector-drawer']",
    title: TOUR.steps[6].title,
    body:  TOUR.steps[6].body,
    position: 'left',
    spotlightPadding: 6,
  },
  {
    id: 'status-bar',
    target: "[data-tour='status-bar']",
    title: TOUR.steps[7].title,
    body:  TOUR.steps[7].body,
    position: 'top',
    spotlightPadding: 4,
  },
  {
    id: 'projects-button',
    target: "[data-tour='projects-button']",
    title: TOUR.steps[8].title,
    body:  TOUR.steps[8].body,
    position: 'bottom',
    spotlightPadding: 6,
  },
  {
    id: 'settings-gear',
    target: "[data-tour='settings-gear']",
    title: TOUR.steps[9].title,
    body:  TOUR.steps[9].body,
    position: 'bottom',
    spotlightPadding: 6,
  },
];
