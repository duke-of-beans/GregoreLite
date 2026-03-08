import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const health = require('../../../app/app/api/aegis/health/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const override = require('../../../app/app/api/aegis/override/route');

export const aegisRouter = Router();

mountRouteModule(aegisRouter, '/health', health);
mountRouteModule(aegisRouter, '/override', override);
