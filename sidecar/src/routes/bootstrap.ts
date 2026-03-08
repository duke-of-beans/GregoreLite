import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const handler = require('../../../app/app/api/bootstrap/route');

export const bootstrapRouter = Router();
mountRouteModule(bootstrapRouter, '/', handler);
