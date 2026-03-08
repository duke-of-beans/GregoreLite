import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const artifact = require('../../../app/app/api/kernl/artifact/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const manifests = require('../../../app/app/api/kernl/manifests/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stats = require('../../../app/app/api/kernl/stats/route');

export const kernlRouter = Router();

mountRouteModule(kernlRouter, '/artifact', artifact);
mountRouteModule(kernlRouter, '/manifests', manifests);
mountRouteModule(kernlRouter, '/stats', stats);
