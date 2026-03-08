import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const handler = require('../../../app/app/api/shimmer-matches/route');

export const shimmerRouter = Router();
mountRouteModule(shimmerRouter, '/', handler);
