/**
 * useReceiptPreference Hook
 * 
 * Manages receipt display preference in localStorage.
 * Part of Phase 5.3 P3 - Orchestration Theater.
 */

'use client';

import { useState, useEffect } from 'react';
import type { ReceiptPreference, ReceiptLevel } from '@/components/chat';

const STORAGE_KEY = 'gregore-receipt-preference';

const DEFAULT_PREFERENCE: ReceiptPreference = {
  level: 'compact',
  showCost: true,
  showModel: true,
  showGhost: true,
  showConfidence: false,
  expandable: true,
};

export function useReceiptPreference() {
  const [preference, setPreference] = useState<ReceiptPreference>(DEFAULT_PREFERENCE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ReceiptPreference;
        setPreference(parsed);
      }
    } catch (error) {
      console.error('Failed to load receipt preference:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage when preference changes
  const savePreference = (newPreference: ReceiptPreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreference));
      setPreference(newPreference);
    } catch (error) {
      console.error('Failed to save receipt preference:', error);
    }
  };

  // Update just the level (convenience method)
  const setLevel = (level: ReceiptLevel) => {
    const newPreference: ReceiptPreference = {
      level,
      showCost: level === 'full' || level === 'compact',
      showModel: level === 'full' || level === 'compact',
      showGhost: level !== 'hidden',
      showConfidence: level === 'full',
      expandable: level !== 'hidden',
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
