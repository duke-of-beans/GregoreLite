import { Router } from 'express';
import { mountRouteModule } from '../router-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const handler = require('../../../app/app/api/onboarding/route');

export const onboardingRouter = Router();
mountRouteModule(onboardingRouter, '/', handler);
