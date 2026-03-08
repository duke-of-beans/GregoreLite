import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const actions = require('../../../app/app/api/agent-sdk/actions/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const budget = require('../../../app/app/api/agent-sdk/budget/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const budgetStatus = require('../../../app/app/api/agent-sdk/budget-status/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jobs = require('../../../app/app/api/agent-sdk/jobs/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jobDetail = require('../../../app/app/api/agent-sdk/jobs/[id]/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jobKill = require('../../../app/app/api/agent-sdk/jobs/[id]/kill/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jobMerge = require('../../../app/app/api/agent-sdk/jobs/[id]/merge/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jobOutput = require('../../../app/app/api/agent-sdk/jobs/[id]/output/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jobRestart = require('../../../app/app/api/agent-sdk/jobs/[id]/restart/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jobSupersede = require('../../../app/app/api/agent-sdk/jobs/[id]/supersede/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jobUnblock = require('../../../app/app/api/agent-sdk/jobs/[id]/unblock/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const status = require('../../../app/app/api/agent-sdk/status/route');

export const agentSdkRouter = Router();

mountRouteModule(agentSdkRouter, '/actions', actions);
mountRouteModule(agentSdkRouter, '/budget', budget);
mountRouteModule(agentSdkRouter, '/budget-status', budgetStatus);
mountRouteModule(agentSdkRouter, '/jobs', jobs);
mountRouteModule(agentSdkRouter, '/jobs/:id', jobDetail, ['id']);
mountRouteModule(agentSdkRouter, '/jobs/:id/kill', jobKill, ['id']);
mountRouteModule(agentSdkRouter, '/jobs/:id/merge', jobMerge, ['id']);
mountRouteModule(agentSdkRouter, '/jobs/:id/output', jobOutput, ['id']);
mountRouteModule(agentSdkRouter, '/jobs/:id/restart', jobRestart, ['id']);
mountRouteModule(agentSdkRouter, '/jobs/:id/supersede', jobSupersede, ['id']);
mountRouteModule(agentSdkRouter, '/jobs/:id/unblock', jobUnblock, ['id']);
mountRouteModule(agentSdkRouter, '/status', status);
