import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const root = require('../../../app/app/api/projects/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const switchRoute = require('../../../app/app/api/projects/switch/route');

export const projectsRouter = Router();

mountRouteModule(projectsRouter, '/', root);
mountRouteModule(projectsRouter, '/switch', switchRoute);
