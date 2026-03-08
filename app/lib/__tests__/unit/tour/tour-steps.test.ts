/**
 * tour-steps.test.ts — Sprint 38.0
 *
 * Validates structural invariants of TOUR_STEPS and the TOUR copy export.
 * No UI rendering — pure data assertions.
 */

import { describe, it, expect } from 'vitest';
import { TOUR_STEPS } from '@/lib/tour/steps';
import { TOUR } from '@/lib/voice/copy-templates';

const VALID_POSITIONS = ['top', 'bottom', 'left', 'right'] as const;

describe('TOUR_STEPS', () => {
  it('has exactly 8 steps', () => {
    expect(TOUR_STEPS).toHaveLength(8);
  });

  it('every step has a non-empty id', () => {
    for (const step of TOUR_STEPS) {
      expect(typeof step.id).toBe('string');
      expect(step.id.trim().length).toBeGreaterThan(0);
    }
  });

  it('every step has a non-empty target selector', () => {
    for (const step of TOUR_STEPS) {
      expect(typeof step.target).toBe('string');
      expect(step.target.trim().length).toBeGreaterThan(0);
    }
  });

  it('every step has a non-empty title', () => {
    for (const step of TOUR_STEPS) {
      expect(typeof step.title).toBe('string');
      expect(step.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('every step has a non-empty body', () => {
    for (const step of TOUR_STEPS) {
      expect(typeof step.body).toBe('string');
      expect(step.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('every step has a valid position', () => {
    for (const step of TOUR_STEPS) {
      expect(VALID_POSITIONS).toContain(step.position);
    }
  });

  it('has no duplicate step IDs', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('has no duplicate target selectors', () => {
    const targets = TOUR_STEPS.map((s) => s.target);
    const unique = new Set(targets);
    expect(unique.size).toBe(targets.length);
  });

  it('step titles match TOUR copy exactly', () => {
    TOUR_STEPS.forEach((step, i) => {
      expect(step.title).toBe(TOUR.steps[i]!.title);
    });
  });

  it('step bodies match TOUR copy exactly', () => {
    TOUR_STEPS.forEach((step, i) => {
      expect(step.body).toBe(TOUR.steps[i]!.body);
    });
  });

  it('spotlightPadding is either undefined or a positive number', () => {
    for (const step of TOUR_STEPS) {
      if (step.spotlightPadding !== undefined) {
        expect(typeof step.spotlightPadding).toBe('number');
        expect(step.spotlightPadding).toBeGreaterThan(0);
      }
    }
  });
});

describe('TOUR copy', () => {
  it('has exactly 8 step copy entries', () => {
    expect(TOUR.steps).toHaveLength(8);
  });

  it('step_counter returns correct format', () => {
    expect(TOUR.step_counter(1, 8)).toBe('1 of 8');
    expect(TOUR.step_counter(8, 8)).toBe('8 of 8');
  });

  it('all button labels are non-empty strings', () => {
    expect(TOUR.skip_button.length).toBeGreaterThan(0);
    expect(TOUR.next_button.length).toBeGreaterThan(0);
    expect(TOUR.finish_button.length).toBeGreaterThan(0);
    expect(TOUR.start_button.length).toBeGreaterThan(0);
  });

  it('welcome modal copy is non-empty', () => {
    expect(TOUR.welcome_title.length).toBeGreaterThan(0);
    expect(TOUR.welcome_subtitle.length).toBeGreaterThan(0);
    expect(TOUR.welcome_cta_primary.length).toBeGreaterThan(0);
    expect(TOUR.welcome_cta_secondary.length).toBeGreaterThan(0);
  });

  it('restart copy is non-empty', () => {
    expect(TOUR.restart_label.length).toBeGreaterThan(0);
    expect(TOUR.restart_description.length).toBeGreaterThan(0);
  });
});
