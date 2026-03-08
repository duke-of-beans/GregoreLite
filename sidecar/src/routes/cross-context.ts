import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const feedback = require('../../../app/app/api/cross-context/feedback/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const inject = require('../../../app/app/api/cross-context/inject/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const suppressed = require('../../../app/app/api/cross-context/suppressed/route');

export const crossContextRouter = Router();

mountRouteModule(crossContextRouter, '/feedback', feedback);
mountRouteModule(crossContextRouter, '/inject', inject);
mountRouteModule(crossContextRouter, '/suppressed', suppressed);
