/**
 * Cognitive Plane Integration Tests
 *
 * Tests availability and basic functionality of the four cognitive planes:
 * - World Model (Plane A): Epistemology
 * - Attention Model (Plane B): Focus
 * - Self Model (Plane C): Metacognition
 * - Homeostasis (Plane D): Behavioral Regulation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AOTSubstrate } from '@/lib/orchestration/substrate/aot-substrate';
import { Engine } from '@/lib/orchestration/substrate/types';

describe('Cognitive Plane Integration Tests', () => {
  let substrate: AOTSubstrate;

  beforeEach(async () => {
    substrate = new AOTSubstrate({
      enable_auto_start: false,
      enable_health_monitoring: false,
      enable_provenance: true,
    });
    await substrate.initialize();
  });

  afterEach(() => {
    substrate.shutdown();
  });

  // ==========================================================================
  // WORLD MODEL (Plane A)
  // ==========================================================================

  describe('World Model - Epistemology Plane', () => {
    it('should provide access to claim ledger', () => {
      const worldModel = substrate.getWorldModel();

      expect(worldModel).toBeDefined();
    });

    it('should maintain world model state', () => {
      const worldModel1 = substrate.getWorldModel();
      const worldModel2 = substrate.getWorldModel();

      // Should return same instance
      expect(worldModel1).toBe(worldModel2);
    });
  });

  // ==========================================================================
  // ATTENTION MODEL (Plane B)
  // ==========================================================================

  describe('Attention Model - Focus Plane', () => {
    it('should provide access to working set', () => {
      const attentionModel = substrate.getAttentionModel();

      expect(attentionModel).toBeDefined();
    });

    it('should maintain attention model state', () => {
      const attentionModel1 = substrate.getAttentionModel();
      const attentionModel2 = substrate.getAttentionModel();

      // Should return same instance
      expect(attentionModel1).toBe(attentionModel2);
    });
  });

  // ==========================================================================
  // SELF MODEL (Plane C) - R > 0 Self-Awareness
  // ==========================================================================

  describe('Self Model - Metacognition Plane', () => {
    it('should provide access to self observer', () => {
      const selfModel = substrate.getSelfModel();

      expect(selfModel).toBeDefined();
    });

    it('should maintain self model state', () => {
      const selfModel1 = substrate.getSelfModel();
      const selfModel2 = substrate.getSelfModel();

      // Should return same instance
      expect(selfModel1).toBe(selfModel2);
    });
  });

  // ==========================================================================
  // HOMEOSTASIS (Plane D) - Behavioral Regulation
  // ==========================================================================

  describe('Homeostasis - Behavioral Regulation Plane', () => {
    it('should provide access to homeostasis engine', () => {
      const homeostasis = substrate.getHomeostasis();

      expect(homeostasis).toBeDefined();
    });

    it('should maintain homeostasis state', () => {
      const homeostasis1 = substrate.getHomeostasis();
      const homeostasis2 = substrate.getHomeostasis();

      // Should return same instance
      expect(homeostasis1).toBe(homeostasis2);
    });

    it('should support homeostasis shutdown', () => {
      const homeostasis = substrate.getHomeostasis();

      expect(homeostasis).toBeDefined();

      // Substrate shutdown should stop homeostasis
      substrate.shutdown();

      expect(substrate.isReady()).toBe(false);
    });
  });

  // ==========================================================================
  // CROSS-PLANE AVAILABILITY
  // ==========================================================================

  describe('Cross-Plane Availability', () => {
    it('should provide access to all planes simultaneously', () => {
      const worldModel = substrate.getWorldModel();
      const attentionModel = substrate.getAttentionModel();
      const selfModel = substrate.getSelfModel();
      const homeostasis = substrate.getHomeostasis();

      expect(worldModel).toBeDefined();
      expect(attentionModel).toBeDefined();
      expect(selfModel).toBeDefined();
      expect(homeostasis).toBeDefined();
    });

    it('should maintain plane instances across access patterns', () => {
      // Access in different orders
      const world1 = substrate.getWorldModel();
      const attention1 = substrate.getAttentionModel();

      const attention2 = substrate.getAttentionModel();
      const world2 = substrate.getWorldModel();

      expect(world1).toBe(world2);
      expect(attention1).toBe(attention2);
    });

    it('should support rapid plane access', () => {
      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        substrate.getWorldModel();
        substrate.getAttentionModel();
        substrate.getSelfModel();
        substrate.getHomeostasis();
      }

      const duration = Date.now() - start;

      // 4000 plane accesses should be very fast (< 50ms)
      expect(duration).toBeLessThan(50);
    });
  });

  // ==========================================================================
  // INTEGRATION WITH ENGINES
  // ==========================================================================

  describe('Integration with Engines', () => {
    it('should allow planes and engines to be accessed together', () => {
      // Planes
      const worldModel = substrate.getWorldModel();
      const selfModel = substrate.getSelfModel();

      // Engines
      const validator = substrate.getEngine(Engine.VALIDATION);
      const oracle = substrate.getEngine(Engine.ORACLE);

      expect(worldModel).toBeDefined();
      expect(selfModel).toBeDefined();
      expect(validator).toBeDefined();
      expect(oracle).toBeDefined();
    });

    it('should maintain system integrity with mixed access', () => {
      const stats1 = substrate.getStats();

      // Access planes
      substrate.getWorldModel();
      substrate.getAttentionModel();

      // Access engines
      substrate.getEngine(Engine.VALIDATION);
      substrate.getEngine(Engine.METABOLISM);

      // Access planes again
      substrate.getSelfModel();
      substrate.getHomeostasis();

      const stats2 = substrate.getStats();

      // System should remain stable
      expect(stats2.total_engines).toBe(stats1.total_engines);
      expect(stats2.engines_ready).toBe(stats1.engines_ready);
    });
  });

  // ==========================================================================
  // INITIALIZATION ORDER
  // ==========================================================================

  describe('Initialization Order', () => {
    it('should initialize planes before engines', async () => {
      const testSubstrate = new AOTSubstrate({
        enable_auto_start: false,
      });

      await testSubstrate.initialize();

      // Planes should be available
      expect(testSubstrate.getWorldModel()).toBeDefined();
      expect(testSubstrate.getAttentionModel()).toBeDefined();
      expect(testSubstrate.getSelfModel()).toBeDefined();
      expect(testSubstrate.getHomeostasis()).toBeDefined();

      // Engines should also be available
      expect(testSubstrate.isReady()).toBe(true);

      testSubstrate.shutdown();
    });

    it('should not provide planes before initialization', () => {
      const testSubstrate = new AOTSubstrate({
        enable_auto_start: false,
      });

      // Before initialization
      expect(testSubstrate.getWorldModel()).toBeUndefined();
      expect(testSubstrate.getAttentionModel()).toBeUndefined();
      expect(testSubstrate.getSelfModel()).toBeUndefined();
      expect(testSubstrate.getHomeostasis()).toBeUndefined();

      testSubstrate.shutdown();
    });
  });

  // ==========================================================================
  // SHUTDOWN COORDINATION
  // ==========================================================================

  describe('Shutdown Coordination', () => {
    it('should coordinate shutdown of all planes', () => {
      expect(substrate.isReady()).toBe(true);

      // Planes available before shutdown
      expect(substrate.getWorldModel()).toBeDefined();
      expect(substrate.getAttentionModel()).toBeDefined();
      expect(substrate.getSelfModel()).toBeDefined();
      expect(substrate.getHomeostasis()).toBeDefined();

      substrate.shutdown();

      // Substrate should not be ready after shutdown
      expect(substrate.isReady()).toBe(false);
    });

    it('should handle shutdown gracefully', () => {
      // Multiple shutdowns should not throw
      substrate.shutdown();
      expect(() => substrate.shutdown()).not.toThrow();
    });
  });

  // ==========================================================================
  // PERFORMANCE BENCHMARKS
  // ==========================================================================

  describe('Performance Benchmarks', () => {
    it('should initialize planes quickly', async () => {
      const testSubstrate = new AOTSubstrate({
        enable_auto_start: false,
        enable_health_monitoring: false,
      });

      const start = Date.now();
      await testSubstrate.initialize();
      const duration = Date.now() - start;

      // Plane initialization should be very fast
      expect(duration).toBeLessThan(500);

      testSubstrate.shutdown();
    });

    it('should provide fast plane access', () => {
      const iterations = 10000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        substrate.getWorldModel();
      }

      const duration = Date.now() - start;

      // 10000 accesses should be very fast (< 50ms)
      expect(duration).toBeLessThan(50);
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle plane access before initialization', () => {
      const testSubstrate = new AOTSubstrate({
        enable_auto_start: false,
      });

      expect(testSubstrate.getWorldModel()).toBeUndefined();
      expect(testSubstrate.getAttentionModel()).toBeUndefined();
      expect(testSubstrate.getSelfModel()).toBeUndefined();
      expect(testSubstrate.getHomeostasis()).toBeUndefined();

      testSubstrate.shutdown();
    });

    it('should handle repeated initialization', async () => {
      await substrate.initialize();

      // Second initialization should be safe
      const result = await substrate.initialize();

      expect(result.ok).toBe(true);
      expect(substrate.getWorldModel()).toBeDefined();
    });
  });
});
