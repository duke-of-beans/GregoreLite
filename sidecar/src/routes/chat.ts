import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// POST /api/chat — SSE streaming response
// fromResponse() detects text/event-stream and pipes chunks automatically
// eslint-disable-next-line @typescript-eslint/no-require-imports
const handler = require('../../../app/app/api/chat/route');

export const chatRouter = Router();

mountRouteModule(chatRouter, '/', handler);
