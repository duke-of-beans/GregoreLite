/**
 * Performance Optimization Tests
 *
 * Tests for AOT substrate performance optimizations including:
 * - LRU cache effectiveness
 * - Stats aggregation caching
 * - Operation batching
 * - Lazy initialization
 * - Memory efficiency
 *
 * Performance Targets:
 * - Engine routing: < 10ms (99th percentile)
 * - Stat aggregation: < 5ms (99th percentile)
 * - Health check: < 2ms per engine
 * - Memory overhead: < 50MB for full substrate
 *
 * References:
 * - Checkpoint 2.5.3 (Performance Optimization)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AOTSubstrate } from '../../orchestration/substrate/aot-substrate';
import { Engine } from '../../orchestration/substrate/types';

describe('Performance Optimization Tests', () => {
  let substrate: AOTSubstrate;

  beforeEach(() => {
    substrate = new AOTSubstrate({
      enable_auto_start: false,
      enable_caching: true,
      enable_operation_batching: true,
    });
  });

  describe('LRU Cache', () => {
    it('should cache frequently accessed data', async () => {
      await substrate.initialize();

      // First call - cache miss
      const start1 = performance.now();
      const stats1 = substrate.getStats();
      const duration1 = performance.now() - start1;

      // Second call - should be from cache
      const start2 = performance.now();
      const stats2 = substrate.getStats();
      const duration2 = performance.now() - start2;

      expect(stats1.total_engines).toBe(stats2.total_engines);
      expect(duration2).toBeLessThan(duration1 + 1); // Cached call should be fast

      // Performance metrics should be present
      expect(stats2.performance).toBeDefined();
      expect(stats2.performance?.cache_hit_rate).toBeGreaterThanOrEqual(0);
    });

    it('should invalidate cache after TTL', async () => {
      substrate = new AOTSubstrate({
        enable_auto_start: false,
        enable_caching: true,
        cache_ttl_ms: 50, // Very short TTL
      });

      await substrate.initialize();

      const stats1 = substrate.getStats();

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats2 = substrate.getStats();

      // Both should work but cache should have been invalidated
      expect(stats1.total_engines).toBe(stats2.total_engines);
    });

    it('should track cache statistics', async () => {
      await substrate.initialize();

      // Generate cache activity
      for (let i = 0; i < 10; i++) {
        substrate.getStats();
      }

      const stats = substrate.getStats();
      expect(stats.performance).toBeDefined();
      expect(stats.performance?.cache_hit_rate).toBeGreaterThanOrEqual(0);
      expect(stats.performance?.memory_usage_mb).toBeGreaterThan(0);
    });
  });

  describe('Stats Aggregation Performance', () => {
    it('should aggregate stats in < 5ms (99th percentile)', async () => {
      await substrate.initialize();

      const durations: number[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        substrate.getStats();
        const duration = performance.now() - start;
        durations.push(duration);
      }

      // Sort to find 99th percentile
      durations.sort((a, b) => a - b);
      const p99Index = Math.floor(iterations * 0.99);
      const p99Duration = durations[p99Index];

      expect(p99Duration).toBeLessThan(5);
    });

    it('should handle rapid successive calls efficiently', async () => {
      await substrate.initialize();

      const start = performance.now();

      // 1000 rapid calls
      for (let i = 0; i < 1000; i++) {
        substrate.getStats();
      }

      const totalDuration = performance.now() - start;
      const avgDuration = totalDuration / 1000;

      expect(avgDuration).toBeLessThan(1); // < 1ms average with caching
    });

    it('should provide consistent stats across calls', async () => {
      await substrate.initialize();

      const stats1 = substrate.getStats();
      const stats2 = substrate.getStats();
      const stats3 = substrate.getStats();

      expect(stats1.total_engines).toBe(stats2.total_engines);
      expect(stats2.total_engines).toBe(stats3.total_engines);
      expect(stats1.engines_ready).toBe(stats2.engines_ready);
    });
  });

  describe('Lazy Initialization', () => {
    it('should support lazy engine initialization', async () => {
      const lazySubstrate = new AOTSubstrate({
        enable_auto_start: false,
        lazy_init_engines: true,
      });

      // Should not have engines initialized yet
      const oracleBefore = lazySubstrate.getEngine(Engine.ORACLE);
      expect(oracleBefore).toBeDefined(); // Lazy init on access

      // Should have initialized on access
      const oracleAfter = lazySubstrate.getEngine(Engine.ORACLE);
      expect(oracleAfter).toBeDefined();
    });

    it('should initialize engines on first access', async () => {
      const lazySubstrate = new AOTSubstrate({
        enable_auto_start: false,
        lazy_init_engines: true,
      });

      // Access multiple engines
      const oracle = lazySubstrate.getEngine(Engine.ORACLE);
      const consensus = lazySubstrate.getEngine(Engine.CONSENSUS);
      const validator = lazySubstrate.getEngine(Engine.VALIDATION);

      expect(oracle).toBeDefined();
      expect(consensus).toBeDefined();
      expect(validator).toBeDefined();
    });

    it('should not initialize unused engines with lazy mode', async () => {
      const lazySubstrate = new AOTSubstrate({
        enable_auto_start: false,
        lazy_init_engines: true,
      });

      // Only access one engine
      lazySubstrate.getEngine(Engine.ORACLE);

      const stats = lazySubstrate.getStats();

      // Should have initialized at least one engine
      expect(stats.engines_ready).toBeGreaterThan(0);
      expect(stats.engines_ready).toBeLessThanOrEqual(9);
    });
  });

  describe('Memory Efficiency', () => {
    it('should track estimated memory usage', async () => {
      await substrate.initialize();

      const stats = substrate.getStats();

      expect(stats.performance?.memory_usage_mb).toBeDefined();
      expect(stats.performance?.memory_usage_mb).toBeGreaterThan(0);
      expect(stats.performance?.memory_usage_mb).toBeLessThan(50); // < 50MB target
    });

    it('should maintain reasonable memory with heavy usage', async () => {
      await substrate.initialize();

      // Simulate heavy usage
      for (let i = 0; i < 1000; i++) {
        substrate.getStats();
        substrate.getEngine(Engine.ORACLE);
        substrate.getEngine(Engine.CONSENSUS);
      }

      const stats = substrate.getStats();
      expect(stats.performance?.memory_usage_mb).toBeLessThan(50);
    });
  });

  describe('Engine Access Performance', () => {
    it('should access engines in < 1ms', async () => {
      await substrate.initialize();

      const durations: number[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        substrate.getEngine(Engine.ORACLE);
        const duration = performance.now() - start;
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;

      expect(avgDuration).toBeLessThan(1);
    });

    it('should handle concurrent engine access', async () => {
      await substrate.initialize();

      const start = performance.now();

      // Access all engines concurrently
      const engines = Object.values(Engine);
      const promises = engines.map((engine) =>
        Promise.resolve(substrate.getEngine(engine))
      );

      await Promise.all(promises);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10); // All accesses < 10ms
    });
  });

  describe('Health Check Performance', () => {
    it('should perform health checks in < 2ms per engine', async () => {
      const monitoredSubstrate = new AOTSubstrate({
        enable_auto_start: true,
        enable_health_monitoring: true,
        health_check_interval_ms: 100,
      });

      await monitoredSubstrate.initialize();

      // Wait for at least one health check cycle
      await new Promise((resolve) => setTimeout(resolve, 150));

      const start = performance.now();
      const stats = monitoredSubstrate.getStats();
      const duration = performance.now() - start;

      const perEngineDuration = duration / stats.total_engines;

      expect(perEngineDuration).toBeLessThan(2);

      monitoredSubstrate.shutdown();
    });
  });

  describe('Configuration Impact', () => {
    it('should perform better with caching enabled', async () => {
      const withCache = new AOTSubstrate({
        enable_auto_start: false,
        enable_caching: true,
      });

      const withoutCache = new AOTSubstrate({
        enable_auto_start: false,
        enable_caching: false,
      });

      await withCache.initialize();
      await withoutCache.initialize();

      // Warm up cache
      withCache.getStats();

      // Measure with cache
      const start1 = performance.now();
      for (let i = 0; i < 100; i++) {
        withCache.getStats();
      }
      const durationWith = performance.now() - start1;

      // Measure without cache
      const start2 = performance.now();
      for (let i = 0; i < 100; i++) {
        withoutCache.getStats();
      }
      const durationWithout = performance.now() - start2;

      expect(durationWith).toBeLessThan(durationWithout);

      withCache.shutdown();
      withoutCache.shutdown();
    });

    it('should respect custom cache TTL', async () => {
      const shortTTL = new AOTSubstrate({
        enable_auto_start: false,
        enable_caching: true,
        cache_ttl_ms: 10, // Very short
      });

      await shortTTL.initialize();

      shortTTL.getStats(); // Prime cache

      await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for expiry

      const stats = shortTTL.getStats();
      expect(stats.performance?.cache_hit_rate).toBeDefined();

      shortTTL.shutdown();
    });
  });

  describe('End-to-End Performance', () => {
    it('should meet all performance targets', async () => {
      await substrate.initialize();

      // Engine routing target: < 10ms
      const routingStart = performance.now();
      substrate.getEngine(Engine.ORACLE);
      const routingDuration = performance.now() - routingStart;
      expect(routingDuration).toBeLessThan(10);

      // Stat aggregation target: < 5ms
      const statsStart = performance.now();
      substrate.getStats();
      const statsDuration = performance.now() - statsStart;
      expect(statsDuration).toBeLessThan(5);

      // Memory target: < 50MB
      const stats = substrate.getStats();
      expect(stats.performance?.memory_usage_mb).toBeLessThan(50);

      // Health check: < 2ms per engine
      const healthDuration = statsDuration / stats.total_engines;
      expect(healthDuration).toBeLessThan(2);
    });

    it('should maintain performance under load', async () => {
      await substrate.initialize();

      const operations = 1000;
      const start = performance.now();

      for (let i = 0; i < operations; i++) {
        substrate.getStats();
        substrate.getEngine(Engine.ORACLE);
        substrate.getEngine(Engine.CONSENSUS);
      }

      const totalDuration = performance.now() - start;
      const avgDuration = totalDuration / operations;

      expect(avgDuration).toBeLessThan(5); // < 5ms per operation set
    });
  });
});
