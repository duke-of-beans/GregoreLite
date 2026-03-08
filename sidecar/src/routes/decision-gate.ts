import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const approve = require('../../../app/app/api/decision-gate/approve/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dismiss = require('../../../app/app/api/decision-gate/dismiss/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const override = require('../../../app/app/api/decision-gate/override/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const policies = require('../../../app/app/api/decision-gate/policies/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const policyDetail = require('../../../app/app/api/decision-gate/policies/[id]/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const policy = require('../../../app/app/api/decision-gate/policy/route');

export const decisionGateRouter = Router();

mountRouteModule(decisionGateRouter, '/approve', approve);
mountRouteModule(decisionGateRouter, '/dismiss', dismiss);
mountRouteModule(decisionGateRouter, '/override', override);
mountRouteModule(decisionGateRouter, '/policies', policies);
mountRouteModule(decisionGateRouter, '/policies/:id', policyDetail, ['id']);
mountRouteModule(decisionGateRouter, '/policy', policy);
