/**
 * useBudgetPreference Hook
 * 
 * Manages budget display preference in localStorage.
 * Part of Phase 5.4 P4 - Settings & Polish.
 */

'use client';

import { useState, useEffect } from 'react';
import type { BudgetPreference, BudgetDisplayLevel } from '@/components/chat/BudgetPreferencePrompt';

const STORAGE_KEY = 'gregore-budget-preference';

const DEFAULT_PREFERENCE: BudgetPreference = {
  level: 'simple',
  showFullMetrics: false,
  showEfficiency: true,
  alertWhenLow: true,
  lowThreshold: 20,
};

export function useBudgetPreference() {
  const [preference, setPreference] = useState<BudgetPreference>(DEFAULT_PREFERENCE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as BudgetPreference;
        setPreference(parsed);
      }
    } catch (error) {
      console.error('Failed to load budget preference:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage when preference changes
  const savePreference = (newPreference: BudgetPreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreference));
      setPreference(newPreference);
    } catch (error) {
      console.error('Failed to save budget preference:', error);
    }
  };

  // Update just the level (convenience method)
  const setLevel = (level: BudgetDisplayLevel) => {
    const newPreference: BudgetPreference = {
      ...preference,
      level,
      showFullMetrics: level === 'full',
      showEfficiency: level === 'simple' || level === 'full',
    };
    savePreference(newPreference);
  };

  // Reset to default
  const resetPreference = () => {
    savePreference(DEFAULT_PREFERENCE);
  };

  return {
    preference,
    isLoaded,
    savePreference,
    setLevel,
    resetPreference,
  };
}
