/**
 * Health Check API Route
 *
 * GET /api/health - Check system health
 *
 * Phase 1: Simple process health. Engines array populated
 * in Phase 2 when KERNL and continuity modules are wired in.
 *
 * @module api/health
 */

import type { HealthCheckResponse } from '@/lib/api/types';
import { successResponse, safeHandler } from '@/lib/api/utils';

const START_TIME = Date.now();

/**
 * GET /api/health
 *
 * Returns system health status
 */
export const GET = safeHandler(async () => {
  let memoryUsageMb = 0;
  try {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      memoryUsageMb = process.memoryUsage().heapUsed / 1024 / 1024;
    }
  } catch {
    memoryUsageMb = 0;
  }

  const uptime = Math.floor((Date.now() - START_TIME) / 1000);

  const health: HealthCheckResponse = {
    status: 'healthy',
    uptime,
    engines: [], // Phase 2: populate with KERNL, continuity module health
    database: 'connected', // Phase 1B: wire actual SQLite check
    memoryUsageMb: Math.round(memoryUsageMb * 100) / 100,
    version: '0.1.0',
  };

  return successResponse(health, 200);
});
