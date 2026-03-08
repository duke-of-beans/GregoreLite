import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const root = require('../../../app/app/api/settings/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const threadTabs = require('../../../app/app/api/settings/thread-tabs/route');

export const settingsRouter = Router();

mountRouteModule(settingsRouter, '/', root);
mountRouteModule(settingsRouter, '/thread-tabs', threadTabs);
