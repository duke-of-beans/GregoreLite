import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const handler = require('../../../app/app/api/artifacts/route');

export const artifactsRouter = Router();
mountRouteModule(artifactsRouter, '/', handler);
