import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const root = require('../../../app/app/api/templates/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const detail = require('../../../app/app/api/templates/[id]/route');

export const templatesRouter = Router();

mountRouteModule(templatesRouter, '/', root);
mountRouteModule(templatesRouter, '/:id', detail, ['id']);
