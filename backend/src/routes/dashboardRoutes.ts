import { Router } from 'express';
import { getHomeDashboard } from '../controllers/dashboardController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT, getHomeDashboard);

export default router;
