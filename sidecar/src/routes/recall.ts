import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const action = require('../../../app/app/api/recall/action/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const active = require('../../../app/app/api/recall/active/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const history = require('../../../app/app/api/recall/history/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const run = require('../../../app/app/api/recall/run/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const recallSettings = require('../../../app/app/api/recall/settings/route');

export const recallRouter = Router();

mountRouteModule(recallRouter, '/action', action);
mountRouteModule(recallRouter, '/active', active);
mountRouteModule(recallRouter, '/history', history);
mountRouteModule(recallRouter, '/run', run);
mountRouteModule(recallRouter, '/settings', recallSettings);
