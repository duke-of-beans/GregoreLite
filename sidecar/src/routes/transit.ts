import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const capture = require('../../../app/app/api/transit/capture/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const events = require('../../../app/app/api/transit/events/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const eventDetail = require('../../../app/app/api/transit/events/[id]/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const insights = require('../../../app/app/api/transit/insights/route');

export const transitRouter = Router();

mountRouteModule(transitRouter, '/capture', capture);
mountRouteModule(transitRouter, '/events', events);
mountRouteModule(transitRouter, '/events/:id', eventDetail, ['id']);
mountRouteModule(transitRouter, '/insights', insights);
