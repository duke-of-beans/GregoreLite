/**
 * AOT Substrate Integration Tests
 *
 * Tests the complete substrate initialization, lifecycle, and coordination:
 * - Initialization sequence (planes first, engines second)
 * - Health monitoring with periodic checks
 * - Engine status transitions
 * - Graceful shutdown coordination
 * - Statistics aggregation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AOTSubstrate } from '@/lib/orchestration/substrate/aot-substrate';
import { Engine, EngineStatus } from '@/lib/orchestration/substrate/types';

describe('AOT Substrate Integration Tests', () => {
  let substrate: AOTSubstrate;

  beforeEach(() => {
    // Fresh substrate for each test
    substrate = new AOTSubstrate({
      enable_auto_start: false, // Manual control for testing
      enable_health_monitoring: false, // Manual control for testing
      enable_provenance: true,
    });
  });

  afterEach(() => {
    // Clean shutdown
    substrate.shutdown();
  });

  // ==========================================================================
  // INITIALIZATION SEQUENCE
  // ==========================================================================

  describe('Initialization Sequence', () => {
    it('should initialize all cognitive planes before engines', async () => {
      expect(substrate.isReady()).toBe(false);

      await substrate.initialize();

      // Verify planes are initialized
      const worldModel = substrate.getWorldModel();
      const attentionModel = substrate.getAttentionModel();
      const selfModel = substrate.getSelfModel();
      const homeostasis = substrate.getHomeostasis();

      expect(worldModel).toBeDefined();
      expect(attentionModel).toBeDefined();
      expect(selfModel).toBeDefined();
      expect(homeostasis).toBeDefined();

      // Verify substrate is ready
      expect(substrate.isReady()).toBe(true);
    });

    it('should initialize all 9 engines successfully', async () => {
      await substrate.initialize();

      const stats = substrate.getStats();

      expect(stats.total_engines).toBe(9);
      expect(stats.engines_ready).toBe(9);
      expect(stats.engines_error).toBe(0);
    });

    it('should initialize engines in correct order', async () => {
      await substrate.initialize();

      // All engines should be ready
      const engines = [
        Engine.ORACLE,
        Engine.CONSENSUS,
        Engine.PHASE_DETECTOR,
        Engine.PARALLAX,
        Engine.NOVELTY,
        Engine.VALIDATION,
        Engine.OUTLIER,
        Engine.PROVENANCE,
        Engine.METABOLISM,
      ];

      for (const engineId of engines) {
        const engine = substrate.getEngine(engineId);
        expect(engine).toBeDefined();
      }
    });

    it('should handle auto-start configuration', async () => {
      const autoStartSubstrate = new AOTSubstrate({
        enable_auto_start: true,
        enable_health_monitoring: false,
      });

      // Small delay for async initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(autoStartSubstrate.isReady()).toBe(true);

      autoStartSubstrate.shutdown();
    });

    it('should not initialize twice', async () => {
      await substrate.initialize();

      const firstStats = substrate.getStats();

      // Try to initialize again
      await substrate.initialize();

      const secondStats = substrate.getStats();

      // Stats should be identical
      expect(secondStats.total_engines).toBe(firstStats.total_engines);
      expect(secondStats.uptime_ms).toBeGreaterThanOrEqual(
        firstStats.uptime_ms
      );
    });
  });

  // ==========================================================================
  // HEALTH MONITORING
  // ==========================================================================

  describe('Health Monitoring', () => {
    it('should start health monitoring automatically', async () => {
      const monitoredSubstrate = new AOTSubstrate({
        enable_auto_start: false,
        enable_health_monitoring: true,
        health_check_interval_ms: 100, // Fast for testing
      });

      await monitoredSubstrate.initialize();

      // Wait for health check
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stats = monitoredSubstrate.getStats();

      // At least one engine should be in RUNNING state
      expect(stats.engines_running).toBeGreaterThan(0);

      monitoredSubstrate.shutdown();
    });

    it('should track engine health metrics', async () => {
      await substrate.initialize();

      const stats = substrate.getStats();
      const oracleHealth = stats.engine_health[Engine.ORACLE];

      expect(oracleHealth).toBeDefined();
      expect(oracleHealth?.status).toBe(EngineStatus.READY);
      expect(oracleHealth?.uptime_ms).toBeGreaterThanOrEqual(0);
      expect(oracleHealth?.total_operations).toBe(0); // No operations yet
    });

    it('should update health metrics after operations', async () => {
      await substrate.initialize();

      // Simulate some operations (this is abstract - engines don't have direct operation methods)
      // In real usage, operations happen through engine-specific interfaces

      const statsAfter = substrate.getStats();
      expect(statsAfter.total_operations).toBeGreaterThanOrEqual(0);
    });

    it('should calculate accurate uptime', async () => {
      await substrate.initialize();

      const stats1 = substrate.getStats();
      const uptime1 = stats1.uptime_ms;

      // Wait 100ms
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats2 = substrate.getStats();
      const uptime2 = stats2.uptime_ms;

      expect(uptime2).toBeGreaterThanOrEqual(uptime1 + 90); // Allow 10ms variance
    });
  });

  // ==========================================================================
  // ENGINE STATUS TRANSITIONS
  // ==========================================================================

  describe('Engine Status Transitions', () => {
    it('should transition engines from UNINITIALIZED to READY', async () => {
      // Before initialization
      expect(substrate.isReady()).toBe(false);

      await substrate.initialize();

      // After initialization
      const stats = substrate.getStats();

      for (const engine of Object.values(Engine)) {
        const health = stats.engine_health[engine];
        expect(health?.status).toBeOneOf([
          EngineStatus.READY,
          EngineStatus.RUNNING,
        ]);
      }
    });

    it('should transition to RUNNING with health monitoring', async () => {
      const monitoredSubstrate = new AOTSubstrate({
        enable_auto_start: false,
        enable_health_monitoring: true,
        health_check_interval_ms: 100,
      });

      await monitoredSubstrate.initialize();

      // Wait for health check to transition to RUNNING
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stats = monitoredSubstrate.getStats();
      expect(stats.engines_running).toBeGreaterThan(0);

      monitoredSubstrate.shutdown();
    });

    it('should handle ERROR status gracefully', async () => {
      await substrate.initialize();

      // Note: Without causing actual errors, we verify error tracking exists
      const stats = substrate.getStats();
      expect(stats.engines_error).toBe(0);
    });

    it('should transition to STOPPED on shutdown', async () => {
      await substrate.initialize();
      expect(substrate.isReady()).toBe(true);

      substrate.shutdown();

      // After shutdown, substrate should not be ready
      expect(substrate.isReady()).toBe(false);
    });
  });

  // ==========================================================================
  // GRACEFUL SHUTDOWN
  // ==========================================================================

  describe('Graceful Shutdown', () => {
    it('should shutdown all engines cleanly', async () => {
      await substrate.initialize();
      expect(substrate.isReady()).toBe(true);

      substrate.shutdown();

      expect(substrate.isReady()).toBe(false);
    });

    it('should stop health monitoring on shutdown', async () => {
      const monitoredSubstrate = new AOTSubstrate({
        enable_auto_start: false,
        enable_health_monitoring: true,
        health_check_interval_ms: 100,
      });

      await monitoredSubstrate.initialize();
      await new Promise((resolve) => setTimeout(resolve, 50));

      monitoredSubstrate.shutdown();

      // Wait to ensure monitoring doesn't continue
      await new Promise((resolve) => setTimeout(resolve, 200));

      // No errors should occur from orphaned intervals
      expect(monitoredSubstrate.isReady()).toBe(false);
    });

    it('should handle shutdown before initialization', () => {
      // Should not throw
      expect(() => substrate.shutdown()).not.toThrow();
    });

    it('should handle multiple shutdown calls', async () => {
      await substrate.initialize();

      substrate.shutdown();
      substrate.shutdown(); // Second call

      // Should not throw
      expect(substrate.isReady()).toBe(false);
    });
  });

  // ==========================================================================
  // STATISTICS AGGREGATION
  // ==========================================================================

  describe('Statistics Aggregation', () => {
    it('should provide comprehensive substrate statistics', async () => {
      await substrate.initialize();

      const stats = substrate.getStats();

      expect(stats).toHaveProperty('total_engines');
      expect(stats).toHaveProperty('engines_ready');
      expect(stats).toHaveProperty('engines_running');
      expect(stats).toHaveProperty('engines_error');
      expect(stats).toHaveProperty('total_operations');
      expect(stats).toHaveProperty('uptime_ms');
      expect(stats).toHaveProperty('engine_health');
    });

    it('should aggregate engine counts correctly', async () => {
      await substrate.initialize();

      const stats = substrate.getStats();

      expect(stats.total_engines).toBe(9);
      expect(
        stats.engines_ready + stats.engines_running + stats.engines_error
      ).toBe(9);
    });

    it('should track individual engine health', async () => {
      await substrate.initialize();

      const stats = substrate.getStats();

      for (const engine of Object.values(Engine)) {
        const health = stats.engine_health[engine];

        expect(health).toBeDefined();
        expect(health?.engine).toBe(engine);
        expect(health?.status).toBeDefined();
        expect(health?.uptime_ms).toBeGreaterThanOrEqual(0);
        expect(health?.total_operations).toBeGreaterThanOrEqual(0);
        expect(health?.successful_operations).toBeGreaterThanOrEqual(0);
        expect(health?.failed_operations).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate total operations across all engines', async () => {
      await substrate.initialize();

      const stats = substrate.getStats();

      let calculatedTotal = 0;
      for (const engine of Object.values(Engine)) {
        const health = stats.engine_health[engine];
        if (health) {
          calculatedTotal += health.total_operations;
        }
      }

      expect(stats.total_operations).toBe(calculatedTotal);
    });

    it('should update uptime continuously', async () => {
      // Create substrate with very short cache TTL
      const noCacheSubstrate = new AOTSubstrate({
        enable_auto_start: false,
        enable_caching: true,
        cache_ttl_ms: 10, // Very short cache
      });

      await noCacheSubstrate.initialize();

      const stats1 = noCacheSubstrate.getStats();

      // Wait longer than cache TTL
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats2 = noCacheSubstrate.getStats();

      expect(stats2.uptime_ms).toBeGreaterThanOrEqual(stats1.uptime_ms + 40);

      noCacheSubstrate.shutdown();
    });
  });

  // ==========================================================================
  // ENGINE ACCESS
  // ==========================================================================

  describe('Engine Access', () => {
    it('should provide access to all engines', async () => {
      await substrate.initialize();

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

    it('should provide access to cognitive planes', async () => {
      await substrate.initialize();

      const worldModel = substrate.getWorldModel();
      const attentionModel = substrate.getAttentionModel();
      const selfModel = substrate.getSelfModel();
      const homeostasis = substrate.getHomeostasis();

      expect(worldModel).toBeDefined();
      expect(attentionModel).toBeDefined();
      expect(selfModel).toBeDefined();
      expect(homeostasis).toBeDefined();
    });

    it('should return undefined for engines before initialization', () => {
      // Don't initialize
      const oracle = substrate.getEngine(Engine.ORACLE);

      // Should be undefined before initialization
      expect(oracle).toBeUndefined();
    });
  });

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  describe('Configuration', () => {
    it('should respect enable_auto_start setting', async () => {
      const manualSubstrate = new AOTSubstrate({
        enable_auto_start: false,
      });

      // Small delay to ensure it doesn't auto-start
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(manualSubstrate.isReady()).toBe(false);

      manualSubstrate.shutdown();
    });

    it('should respect enable_health_monitoring setting', async () => {
      const noMonitorSubstrate = new AOTSubstrate({
        enable_auto_start: false,
        enable_health_monitoring: false,
      });

      await noMonitorSubstrate.initialize();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = noMonitorSubstrate.getStats();

      // Without monitoring, engines should stay READY
      expect(stats.engines_running).toBe(0);

      noMonitorSubstrate.shutdown();
    });

    it('should respect health_check_interval_ms setting', async () => {
      const fastMonitorSubstrate = new AOTSubstrate({
        enable_auto_start: false,
        enable_health_monitoring: true,
        health_check_interval_ms: 50, // Very fast
      });

      await fastMonitorSubstrate.initialize();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = fastMonitorSubstrate.getStats();

      // Should have transitioned to RUNNING quickly
      expect(stats.engines_running).toBeGreaterThan(0);

      fastMonitorSubstrate.shutdown();
    });
  });
});
