/**
 * Health Check API Route
 *
 * GET /api/health - Check system health
 *
 * @module api/health
 */

import { AOTSubstrate } from '@/lib/orchestration/substrate/aot-substrate';
import { Engine } from '@/lib/orchestration/substrate/types';
import type { HealthCheckResponse } from '@/lib/api/types';
import { successResponse, safeHandler } from '@/lib/api/utils';

// Track server start time
const START_TIME = Date.now();

/**
 * GET /api/health
 *
 * Returns system health status
 */
export const GET = safeHandler(async () => {
  // Initialize substrate to check engines
  const substrate = new AOTSubstrate({ lazy_init_engines: true });
  await substrate.initialize();

  // Get engine health
  const allHealth = substrate.getManager().getAllHealth();

  const engines = Object.values(Engine).map((engine) => {
    const health = allHealth.get(engine);
    const status = health?.status || 'error';
    return {
      name: engine,
      status: status as 'ready' | 'initializing' | 'error',
    };
  });

  // Check if all engines are ready
  const allReady = engines.every((e) => e.status === 'ready');

  // Get memory usage (safely handle if process is not available)
  let memoryUsageMb = 0;
  try {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
    }
  } catch {
    // Process not available (browser environment?)
    memoryUsageMb = 0;
  }

  // Calculate uptime
  const uptime = Math.floor((Date.now() - START_TIME) / 1000);

  const health: HealthCheckResponse = {
    status: allReady ? 'healthy' : 'degraded',
    uptime,
    engines,
    database: 'connected', // TODO: Check actual database connection
    memoryUsageMb: Math.round(memoryUsageMb * 100) / 100,
    version: '0.1.0',
  };

  // Shutdown substrate after check
  substrate.shutdown();

  return successResponse(health, 200);
});
