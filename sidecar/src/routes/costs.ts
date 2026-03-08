import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const breakdown = require('../../../app/app/api/costs/breakdown/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const today = require('../../../app/app/api/costs/today/route');

export const costsRouter = Router();

mountRouteModule(costsRouter, '/breakdown', breakdown);
mountRouteModule(costsRouter, '/today', today);
