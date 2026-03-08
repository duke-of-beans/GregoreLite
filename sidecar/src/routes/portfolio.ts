import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const root = require('../../../app/app/api/portfolio/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scan = require('../../../app/app/api/portfolio/scan/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const detail = require('../../../app/app/api/portfolio/[id]/route');

export const portfolioRouter = Router();

mountRouteModule(portfolioRouter, '/', root);
mountRouteModule(portfolioRouter, '/scan', scan);
// NOTE: /scan must be mounted before /:id so Express matches it first
mountRouteModule(portfolioRouter, '/:id', detail, ['id']);
