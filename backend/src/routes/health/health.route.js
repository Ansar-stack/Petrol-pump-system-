import { Router } from 'express';
import { healthCheck } from '../../controllers/health/health.controller.js';

const healthRouter = Router();

// GET /api/health
healthRouter.get('/', healthCheck);

export default healthRouter;
