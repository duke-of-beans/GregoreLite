import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const root = require('../../../app/app/api/decisions/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const exportRoute = require('../../../app/app/api/decisions/export/route');

export const decisionsRouter = Router();

mountRouteModule(decisionsRouter, '/', root);
mountRouteModule(decisionsRouter, '/export', exportRoute);
