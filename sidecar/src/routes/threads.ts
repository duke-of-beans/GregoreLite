import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const root = require('../../../app/app/api/threads/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const detail = require('../../../app/app/api/threads/[id]/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const search = require('../../../app/app/api/threads/[id]/search/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const truncate = require('../../../app/app/api/threads/[id]/truncate-after/[messageId]/route');

export const threadsRouter = Router();

// GET /api/threads
mountRouteModule(threadsRouter, '/', root);

// PATCH|DELETE /api/threads/:id
mountRouteModule(threadsRouter, '/:id', detail, ['id']);

// GET /api/threads/:id/search
mountRouteModule(threadsRouter, '/:id/search', search, ['id']);

// DELETE /api/threads/:id/truncate-after/:messageId
mountRouteModule(threadsRouter, '/:id/truncate-after/:messageId', truncate, ['id', 'messageId']);
