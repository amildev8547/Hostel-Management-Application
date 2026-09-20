import { Router } from 'express';
import { getHomeDashboard } from '../controllers/dashboardController';
import { authenticateJWT, requireOrganization } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT, requireOrganization, getHomeDashboard);

export default router;
