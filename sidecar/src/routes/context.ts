import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const handler = require('../../../app/app/api/context/route');

export const contextRouter = Router();
mountRouteModule(contextRouter, '/', handler);
