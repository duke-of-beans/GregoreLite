import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const root = require('../../../app/app/api/capture/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const inbox = require('../../../app/app/api/capture/inbox/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stats = require('../../../app/app/api/capture/stats/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dismiss = require('../../../app/app/api/capture/[id]/dismiss/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const promote = require('../../../app/app/api/capture/[id]/promote/route');

export const captureRouter = Router();

// Static sub-routes must come before /:id to avoid shadowing
mountRouteModule(captureRouter, '/inbox', inbox);
mountRouteModule(captureRouter, '/stats', stats);
mountRouteModule(captureRouter, '/:id/dismiss', dismiss, ['id']);
mountRouteModule(captureRouter, '/:id/promote', promote, ['id']);
mountRouteModule(captureRouter, '/', root);
