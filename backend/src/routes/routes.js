import { Router } from 'express';
import healthRouter from './health/health.route.js';

const router = Router();

router.use('/api/health', healthRouter);

export default router;
