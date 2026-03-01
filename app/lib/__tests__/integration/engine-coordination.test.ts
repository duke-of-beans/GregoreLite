/**
 * Engine Coordination Integration Tests
 *
 * Tests basic inter-engine availability and substrate coordination:
 * - All 9 engines are accessible through substrate
 * - All 4 cognitive planes are accessible
 * - Engines can be initialized and accessed
 * - Basic substrate statistics work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AOTSubstrate } from '@/lib/orchestration/substrate/aot-substrate';
import { Engine } from '@/lib/orchestration/substrate/types';

describe('Engine Coordination Integration Tests', () => {
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
  // ENGINE AVAILABILITY
  // ==========================================================================

  describe('Engine Availability', () => {
    it('should make all 9 engines accessible', () => {
      const oracle = substrate.getEngine(Engine.ORACLE);
      const consensus = substrate.getEngine(Engine.CONSENSUS);
      const phaseDetector = substrate.getEngine(Engine.PHASE_DETECTOR);
      const parallax = substrate.getEngine(Engine.PARALLAX);
      const novelty = substrate.getEngine(Engine.NOVELTY);
      const validation = substrate.getEngine(Engine.VALIDATION);
      const outlier = substrate.getEngine(Engine.OUTLIER);
      const provenance = substrate.getEngine(Engine.PROVENANCE);
      const metabolism = substrate.getEngine(Engine.METABOLISM);

      expect(oracle).toBeDefined();
      expect(consensus).toBeDefined();
      expect(phaseDetector).toBeDefined();
      expect(parallax).toBeDefined();
      expect(novelty).toBeDefined();
      expect(validation).toBeDefined();
      expect(outlier).toBeDefined();
      expect(provenance).toBeDefined();
      expect(metabolism).toBeDefined();
    });

    it('should make all 4 cognitive planes accessible', () => {
      const worldModel = substrate.getWorldModel();
      const attentionModel = substrate.getAttentionModel();
      const selfModel = substrate.getSelfModel();
      const homeostasis = substrate.getHomeostasis();

      expect(worldModel).toBeDefined();
      expect(attentionModel).toBeDefined();
      expect(selfModel).toBeDefined();
      expect(homeostasis).toBeDefined();
    });

    it('should provide engine type safety', () => {
      // Engines should be accessible by enum
      for (const engineType of Object.values(Engine)) {
        const engine = substrate.getEngine(engineType);
        expect(engine).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // SUBSTRATE COORDINATION
  // ==========================================================================

  describe('Substrate Coordination', () => {
    it('should coordinate initialization of all systems', async () => {
      const stats = substrate.getStats();

      expect(stats.total_engines).toBe(9);
      expect(stats.engines_ready).toBe(9);
      expect(stats.engines_error).toBe(0);
    });

    it('should provide unified statistics across all engines', () => {
      const stats = substrate.getStats();

      expect(stats).toHaveProperty('total_engines');
      expect(stats).toHaveProperty('engines_ready');
      expect(stats).toHaveProperty('engines_running');
      expect(stats).toHaveProperty('engines_error');
      expect(stats).toHaveProperty('total_operations');
      expect(stats).toHaveProperty('uptime_ms');
      expect(stats).toHaveProperty('engine_health');
    });

    it('should track engine health individually', () => {
      const stats = substrate.getStats();

      for (const engineType of Object.values(Engine)) {
        const health = stats.engine_health[engineType];

        expect(health).toBeDefined();
        expect(health?.engine).toBe(engineType);
        expect(health?.uptime_ms).toBeGreaterThanOrEqual(0);
      }
    });

    it('should support graceful shutdown of all systems', () => {
      expect(substrate.isReady()).toBe(true);

      substrate.shutdown();

      expect(substrate.isReady()).toBe(false);
    });
  });

  // ==========================================================================
  // ENGINE INTERACTION POTENTIAL
  // ==========================================================================

  describe('Engine Interaction Potential', () => {
    it('should allow engines to be accessed together', () => {
      // Engines can be accessed simultaneously for coordination
      const oracle = substrate.getEngine(Engine.ORACLE);
      const metabolism = substrate.getEngine(Engine.METABOLISM);

      expect(oracle).toBeDefined();
      expect(metabolism).toBeDefined();
    });

    it('should allow planes and engines to be accessed together', () => {
      // Planes and engines can work together
      const worldModel = substrate.getWorldModel();
      const validation = substrate.getEngine(Engine.VALIDATION);

      expect(worldModel).toBeDefined();
      expect(validation).toBeDefined();
    });

    it('should maintain system integrity across access patterns', () => {
      // Multiple accesses should not corrupt state
      const stats1 = substrate.getStats();

      // Access all engines
      for (const engineType of Object.values(Engine)) {
        substrate.getEngine(engineType);
      }

      // Access all planes
      substrate.getWorldModel();
      substrate.getAttentionModel();
      substrate.getSelfModel();
      substrate.getHomeostasis();

      const stats2 = substrate.getStats();

      // Stats should be consistent
      expect(stats2.total_engines).toBe(stats1.total_engines);
      expect(stats2.engines_ready).toBe(stats1.engines_ready);
    });
  });

  // ==========================================================================
  // PERFORMANCE BENCHMARKS
  // ==========================================================================

  describe('Performance Benchmarks', () => {
    it('should initialize all systems quickly', async () => {
      const testSubstrate = new AOTSubstrate({
        enable_auto_start: false,
        enable_health_monitoring: false,
      });

      const start = Date.now();
      await testSubstrate.initialize();
      const duration = Date.now() - start;

      // Should initialize in under 1 second
      expect(duration).toBeLessThan(1000);
      expect(testSubstrate.isReady()).toBe(true);

      testSubstrate.shutdown();
    });

    it('should provide fast stat aggregation', () => {
      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        substrate.getStats();
      }

      const duration = Date.now() - start;

      // 100 stat queries should be very fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should support rapid engine access', () => {
      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        substrate.getEngine(Engine.ORACLE);
        substrate.getEngine(Engine.VALIDATION);
        substrate.getEngine(Engine.METABOLISM);
      }

      const duration = Date.now() - start;

      // 3000 engine accesses should be very fast (< 50ms)
      expect(duration).toBeLessThan(50);
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle shutdown of uninitialized substrate', () => {
      const testSubstrate = new AOTSubstrate({
        enable_auto_start: false,
      });

      // Should not throw
      expect(() => testSubstrate.shutdown()).not.toThrow();
    });

    it('should handle multiple initializations gracefully', async () => {
      await substrate.initialize();

      // Second initialization should not cause errors
      const result = await substrate.initialize();

      expect(result.ok).toBe(true);
    });

    it('should handle engine access before initialization', () => {
      const testSubstrate = new AOTSubstrate({
        enable_auto_start: false,
      });

      const oracle = testSubstrate.getEngine(Engine.ORACLE);

      // Should return undefined, not throw
      expect(oracle).toBeUndefined();

      testSubstrate.shutdown();
    });
  });

  // ==========================================================================
  // CONFIGURATION TESTING
  // ==========================================================================

  describe('Configuration Testing', () => {
    it('should support custom configuration', async () => {
      const customSubstrate = new AOTSubstrate({
        enable_auto_start: true, // Auto-start
        enable_health_monitoring: true,
        enable_provenance: false, // No provenance
        health_check_interval_ms: 1000,
      });

      // Small delay for auto-start
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(customSubstrate.isReady()).toBe(true);

      const config = customSubstrate.getConfig();
      expect(config.enable_auto_start).toBe(true);
      expect(config.enable_health_monitoring).toBe(true);
      expect(config.enable_provenance).toBe(false);
      expect(config.health_check_interval_ms).toBe(1000);

      customSubstrate.shutdown();
    });

    it('should use default configuration when not specified', async () => {
      const defaultSubstrate = new AOTSubstrate();

      // Auto-start is true by default
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(defaultSubstrate.isReady()).toBe(true);

      const config = defaultSubstrate.getConfig();
      expect(config.enable_auto_start).toBe(true);
      expect(config.enable_health_monitoring).toBe(true);
      expect(config.enable_provenance).toBe(true);

      defaultSubstrate.shutdown();
    });
  });
});
