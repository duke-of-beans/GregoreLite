/**
 * Import routes — Sprint 37.0
 *
 * Thin sidecar wrappers around the Next.js App Router import handlers.
 * Route modules live in app/api/import/ (not app/app/api/).
 *
 * Mounts:
 *   GET    /sources
 *   DELETE /sources/:sourceId
 *   GET    /watchfolder-config
 *   POST   /watchfolder-config
 *   POST   /upload
 *   GET    /progress/:sourceId
 */

import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sources = require('../../../app/api/import/sources/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sourcesById = require('../../../app/api/import/sources/[sourceId]/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const watchfolderConfig = require('../../../app/api/import/watchfolder-config/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const upload = require('../../../app/api/import/upload/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const progress = require('../../../app/api/import/progress/[sourceId]/route');

export const importRouter = Router();

// Static routes before parameterised ones
mountRouteModule(importRouter, '/watchfolder-config', watchfolderConfig);
mountRouteModule(importRouter, '/upload', upload);
mountRouteModule(importRouter, '/sources', sources);
mountRouteModule(importRouter, '/sources/:sourceId', sourcesById, ['sourceId']);
mountRouteModule(importRouter, '/progress/:sourceId', progress, ['sourceId']);
