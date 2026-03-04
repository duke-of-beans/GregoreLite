/**
 * Density Store — Sprint 10.6
 *
 * Three message density presets. Persisted to localStorage.
 * CSS variables set on the message list container — messages read from them.
 */

import { create } from 'zustand';

export type Density = 'compact' | 'comfortable' | 'spacious';

interface DensityState {
  density: Density;
  autoScroll: boolean;
  setDensity: (d: Density) => void;
  cycleDensity: (direction: 'up' | 'down') => void;
  setAutoScroll: (enabled: boolean) => void;
}

const STORAGE_KEY = 'greglite-density';
const SCROLL_KEY = 'greglite-autoscroll';
const ORDER: Density[] = ['compact', 'comfortable', 'spacious'];

export const useDensityStore = create<DensityState>((set) => ({
  density: 'comfortable',
  autoScroll: true,

  setDensity: (d) => {
    localStorage.setItem(STORAGE_KEY, d);
    set({ density: d });
  },

  cycleDensity: (direction) => {
    set((state) => {
      const idx = ORDER.indexOf(state.density);
      const next = direction === 'up'
        ? ORDER[Math.max(0, idx - 1)]!
        : ORDER[Math.min(ORDER.length - 1, idx + 1)]!;
      localStorage.setItem(STORAGE_KEY, next);
      return { density: next };
    });
  },

  setAutoScroll: (enabled) => {
    localStorage.setItem(SCROLL_KEY, String(enabled));
    set({ autoScroll: enabled });
  },
}));

export const DENSITY_CONFIG = {
  compact:     { fontSize: '13px', lineHeight: '1.4', gap: '8px',  padding: '6px 0',  roleLabelSize: '10px' },
  comfortable: { fontSize: '14px', lineHeight: '1.5', gap: '12px', padding: '8px 0',  roleLabelSize: '11px' },
  spacious:    { fontSize: '15px', lineHeight: '1.6', gap: '20px', padding: '12px 0', roleLabelSize: '12px' },
} as const;