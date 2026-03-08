import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const chunks = require('../../../app/app/api/ghost/chunks/[chunkId]/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const exclusionLog = require('../../../app/app/api/ghost/exclusion-log/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const exclusions = require('../../../app/app/api/ghost/exclusions/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ingestFile = require('../../../app/app/api/ghost/ingest-file/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const inject = require('../../../app/app/api/ghost/inject/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const items = require('../../../app/app/api/ghost/items/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const preferences = require('../../../app/app/api/ghost/preferences/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const purge = require('../../../app/app/api/ghost/purge/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const settings = require('../../../app/app/api/ghost/settings/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const start = require('../../../app/app/api/ghost/start/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ghostStatus = require('../../../app/app/api/ghost/status/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stop = require('../../../app/app/api/ghost/stop/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const suggestionFeedback = require('../../../app/app/api/ghost/suggestions/[id]/feedback/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const watchPaths = require('../../../app/app/api/ghost/watch-paths/route');

export const ghostRouter = Router();

mountRouteModule(ghostRouter, '/chunks/:chunkId', chunks, ['chunkId']);
mountRouteModule(ghostRouter, '/exclusion-log', exclusionLog);
mountRouteModule(ghostRouter, '/exclusions', exclusions);
mountRouteModule(ghostRouter, '/ingest-file', ingestFile);
mountRouteModule(ghostRouter, '/inject', inject);
mountRouteModule(ghostRouter, '/items', items);
mountRouteModule(ghostRouter, '/preferences', preferences);
mountRouteModule(ghostRouter, '/purge', purge);
mountRouteModule(ghostRouter, '/settings', settings);
mountRouteModule(ghostRouter, '/start', start);
mountRouteModule(ghostRouter, '/status', ghostStatus);
mountRouteModule(ghostRouter, '/stop', stop);
mountRouteModule(ghostRouter, '/suggestions/:id/feedback', suggestionFeedback, ['id']);
mountRouteModule(ghostRouter, '/watch-paths', watchPaths);
