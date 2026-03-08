import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const handler = require('../../../app/app/api/restore/route');

export const restoreRouter = Router();
mountRouteModule(restoreRouter, '/', handler);
