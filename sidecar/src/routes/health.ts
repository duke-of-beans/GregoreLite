import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// Wraps the existing Next.js health route (returns DB status, uptime, etc.)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const handler = require('../../../app/app/api/health/route');

export const healthRouter = Router();
mountRouteModule(healthRouter, '/', handler);
