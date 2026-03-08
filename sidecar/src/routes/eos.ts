import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fp = require('../../../app/app/api/eos/fp/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const history = require('../../../app/app/api/eos/history/route');

export const eosRouter = Router();

mountRouteModule(eosRouter, '/fp', fp);
mountRouteModule(eosRouter, '/history', history);
